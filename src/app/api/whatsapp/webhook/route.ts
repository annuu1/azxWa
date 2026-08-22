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

    let [contact] = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.whatsappId, contactWhatsappId),
          eq(contacts.organizationId, orgId)
        )
      )
      .limit(1);

    if (!contact) {
      [contact] = await db
        .insert(contacts)
        .values({
          organizationId: orgId,
          whatsappId: contactWhatsappId,
          name: (data.raw?.pushName || data.raw?.name || contactWhatsappId.split('@')[0]),
          pushName: data.raw?.pushName || null,
          isGroup: isGroup,
          aiEnabled: true,
        })
        .returning();
      console.log(`[Webhook] Created new CRM contact: ${contact.name} (${contactWhatsappId})`);
    }

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

    if (fromMe) {
      const cleanBody = incomingMessage.substring(0, 60);
      const fiveSecondsAgo = new Date(Date.now() - 5000);

      const [recentAiSent] = await db
        .select()
        .from(activities)
        .where(
          and(
            eq(activities.contactId, contact.id),
            eq(activities.type, 'MESSAGE_SENT'),
            like(activities.description, `AI Auto-reply: %${cleanBody}%`),
            gte(activities.createdAt, fiveSecondsAgo)
          )
        )
        .limit(1);

      if (recentAiSent) {
        console.log(`[Webhook] AI auto-reply event detected for contact "${contactWhatsappId}". Keeping AI enabled.`);
        return NextResponse.json({ success: true, message: 'AI auto-reply event ignored' });
      }

      if (contact.aiEnabled) {
        await db
          .update(contacts)
          .set({ aiEnabled: false })
          .where(eq(contacts.id, contact.id));
        console.log(`[Webhook] Outgoing manual message detected on device. Deactivated AI auto-reply for contact "${contactWhatsappId}"`);
      }
      return NextResponse.json({ success: true, message: 'Self-message processed (AI auto-reply disabled for contact)' });
    }

    if (isGroup) {
      return NextResponse.json({ success: true, message: 'Message ignored (Group chat)' });
    }

    const [aiConfig] = await db
      .select()
      .from(aiSettings)
      .where(eq(aiSettings.organizationId, orgId))
      .limit(1);

    if (!aiConfig || !aiConfig.enabled) {
      return NextResponse.json({ success: true, message: 'AI Auto-Reply is disabled globally for this organization' });
    }

    if (!contact.aiEnabled) {
      console.log(`[Webhook] AI Auto-Reply skipped for contact "${contactWhatsappId}" (Human agent handoff is active).`);
      return NextResponse.json({ success: true, message: 'AI auto-reply paused (human handoff active)' });
    }

    await db.insert(activities).values({
      organizationId: orgId,
      contactId: contact.id,
      type: 'MESSAGE_RECEIVED',
      description: `Incoming message: "${incomingMessage.substring(0, 60)}${incomingMessage.length > 60 ? '...' : ''}"`,
    });

    // Up to 30 historical messages for prompt context
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

    const aiResponse = await generateAIResponse(orgId, history, incomingMessage);

    if (aiResponse) {
      console.log(`[Webhook] Sending AI Auto-Reply to ${contactWhatsappId}: "${aiResponse.substring(0, 45)}..."`);

      await db.insert(activities).values({
        organizationId: orgId,
        contactId: contact.id,
        type: 'MESSAGE_SENT',
        description: `AI Auto-reply: "${aiResponse.substring(0, 60)}${aiResponse.length > 60 ? '...' : ''}"`,
      });

      await engineSendMessage(sessionId, contactWhatsappId, aiResponse);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error(`[Webhook] Fatal error processing webhook request:`, err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
