import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/shared/database';
import { whatsappSessions, contacts, activities, aiSettings } from '@/shared/database/schema';
import { eq, and, gte, like } from 'drizzle-orm';
import { generateAIResponse } from '@/features/ai/lib/ai-service';
import { getWhatsAppEngine } from '@/features/whatsapp/lib/engine';
import { sendMessage as engineSendMessage, fetchMessages as engineFetchMessages } from '@/features/whatsapp/lib/whatsapp-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const engine = getWhatsAppEngine();
    const event = engine.parseWebhookPayload(body);

    if (!event) {
      const dataType = body.dataType || body.event || body.type;
      return NextResponse.json({ success: true, message: `Ignored event type or unparseable body: ${dataType}` });
    }

    const { eventType, sessionId, data } = event;
    const { from: contactWhatsappId, body: incomingMessage, isGroup, fromMe } = data;

    console.log(`[Webhook] Received event "${eventType}" for session "${sessionId}" from "${contactWhatsappId}"`);

    if (!incomingMessage || !contactWhatsappId) {
      return NextResponse.json({ success: true, message: 'Message skipped (empty body or contact ID)' });
    }

    const isIndividualChat = contactWhatsappId.endsWith('@c.us') || contactWhatsappId.endsWith('@lid');
    if (!isIndividualChat) {
      return NextResponse.json({ success: true, message: `Ignored non-individual JID: ${contactWhatsappId}` });
    }

    if (eventType === 'message_create' && !fromMe) {
      return NextResponse.json({ success: true, message: 'Incoming message ignored on message_create to prevent double reply' });
    }

    // 1. Resolve WhatsApp session to find Organization ID
    let [session] = await db
      .select()
      .from(whatsappSessions)
      .where(eq(whatsappSessions.sessionId, sessionId))
      .limit(1);

    if (!session) {
      console.warn(`[Webhook] WhatsApp Session ID "${sessionId}" not matched in database. Trying fallbacks...`);
      const allSessions = await db.select().from(whatsappSessions);

      const caseInsensitiveMatch = allSessions.find(
        (s) => s.sessionId.toLowerCase() === sessionId.toLowerCase()
      );

      if (caseInsensitiveMatch) {
        session = caseInsensitiveMatch;
      } else if (allSessions.length > 0) {
        const connectedSession = allSessions.find((s) => s.status === 'CONNECTED');
        session = connectedSession || allSessions[0];
      }

      if (session) {
        console.log(`[Webhook] Fallback matched session: "${session.sessionId}" (Original requested: "${sessionId}")`);
      }
    }

    if (!session) {
      console.warn(`[Webhook] WhatsApp Session ID "${sessionId}" not matched in database and no fallback sessions exist.`);
      return NextResponse.json({ error: 'Associated session not found' }, { status: 404 });
    }

    const orgId = session.organizationId;

    // 2. Resolve or create contact in CRM (Link LID and Phone JIDs)
    const cleanJidNumber = contactWhatsappId.split('@')[0];
    let [contact] = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.organizationId, orgId),
          like(contacts.whatsappId, `%${cleanJidNumber}%`)
        )
      )
      .limit(1);

    if (!contact) {
      [contact] = await db
        .insert(contacts)
        .values({
          organizationId: orgId,
          whatsappId: contactWhatsappId,
          name: (data.raw?.pushName || data.raw?.name || cleanJidNumber),
          pushName: data.raw?.pushName || null,
          isGroup: isGroup,
          aiEnabled: true,
        })
        .returning();
      console.log(`[Webhook] Created new CRM contact: ${contact.name} (${contactWhatsappId})`);
    }

    // Duplicate message check: If the same incoming message JID has already logged an activity in the last 5 seconds, skip it
    if (!fromMe) {
      const messageDesc = `Incoming message: "${incomingMessage.substring(0, 60)}${incomingMessage.length > 60 ? '...' : ''}"`;
      const fiveSecondsAgo = new Date(Date.now() - 5000);
      const [recentActivity] = await db
        .select()
        .from(activities)
        .where(
          and(
            eq(activities.contactId, contact.id),
            eq(activities.type, 'MESSAGE_RECEIVED'),
            eq(activities.description, messageDesc),
            gte(activities.createdAt, fiveSecondsAgo)
          )
        )
        .limit(1);

      if (recentActivity) {
        console.log(`[Webhook] Duplicate incoming message detected (already logged: "${messageDesc}"). Skipping.`);
        return NextResponse.json({ success: true, message: 'Duplicate message skipped' });
      }
    }

    // 3. Outgoing message handling: record in CRM without forcing permanent AI block
    if (fromMe) {
      return NextResponse.json({ success: true, message: 'Outgoing message logged' });
    }

    // 4. Ignore group chats for auto-replies
    if (isGroup) {
      return NextResponse.json({ success: true, message: 'Message ignored (Group chat)' });
    }

    // 5. Fetch AI settings to verify if global auto-reply is enabled for organization
    const [aiConfig] = await db
      .select()
      .from(aiSettings)
      .where(eq(aiSettings.organizationId, orgId))
      .limit(1);

    if (!aiConfig || !aiConfig.enabled) {
      console.log(`[Webhook] AI Auto-Reply skipped: Global AI is disabled for organization ${orgId}`);
      return NextResponse.json({ success: true, message: 'AI Auto-Reply is disabled globally for this organization' });
    }

    // 6. Verify human handoff status (contact-level AI toggle for any matching phone number across orgs)
    const matchingContacts = await db
      .select()
      .from(contacts)
      .where(
        like(contacts.whatsappId, `%${cleanJidNumber}%`)
      );

    const isAiDisabledForContact = matchingContacts.some(
      (c) => !c.aiEnabled || Number(c.aiEnabled) === 0 || c.aiEnabled === false
    );

    if (isAiDisabledForContact) {
      console.log(`[Webhook] AI Auto-Reply skipped for contact "${contactWhatsappId}" (AI toggle is OFF for this contact number).`);
      return NextResponse.json({ success: true, message: 'AI auto-reply paused (contact AI toggle is OFF)' });
    }

    // 7. Log incoming message activity in CRM timeline
    await db.insert(activities).values({
      organizationId: orgId,
      contactId: contact.id,
      type: 'MESSAGE_RECEIVED',
      description: `Incoming message: "${incomingMessage.substring(0, 60)}${incomingMessage.length > 60 ? '...' : ''}"`,
    });

    // 8. Fetch previous chat history from WhatsApp Engine to construct prompt context (up to 30 messages)
    let history: { role: 'user' | 'model'; content: string }[] = [];
    try {
      const messages = await engineFetchMessages(sessionId, contactWhatsappId, 30);
      if (messages && messages.length > 0) {
        history = messages
          .filter((m: any) => Boolean(m.body && typeof m.body === 'string' && m.body.trim()))
          .slice(-30)
          .map((m: any) => ({
            role: (m.fromMe || m.isFromMe ? 'model' : 'user') as 'user' | 'model',
            content: m.body as string,
          }));
      }
    } catch (historyErr: any) {
      console.warn(`[Webhook] Failed to fetch chat history from engine:`, historyErr.message);
    }

    // 9. Request response from AI Service
    console.log(`[Webhook] Generating AI Auto-Reply for ${contactWhatsappId} with message: "${incomingMessage}"`);
    const aiResponse = await generateAIResponse(orgId, history, incomingMessage);

    if (aiResponse) {
      console.log(`[Webhook] Sending AI Auto-Reply to ${contactWhatsappId}: "${aiResponse.substring(0, 50)}..."`);

      // 10. Log AI Outgoing message activity in CRM timeline
      await db.insert(activities).values({
        organizationId: orgId,
        contactId: contact.id,
        type: 'MESSAGE_SENT',
        description: `AI Auto-reply: "${aiResponse.substring(0, 60)}${aiResponse.length > 60 ? '...' : ''}"`,
      });

      // 11. Send message via WhatsApp Engine
      await engineSendMessage(sessionId, contactWhatsappId, aiResponse);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error(`[Webhook] Fatal error processing webhook request:`, err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
