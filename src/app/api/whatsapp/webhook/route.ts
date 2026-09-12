import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/shared/database';
import { whatsappSessions, contacts, activities, aiSettings } from '@/shared/database/schema';
import { eq, and, gte, like, or } from 'drizzle-orm';
import { generateAIResponse } from '@/features/ai/lib/ai-service';
import { getWhatsAppEngine } from '@/features/whatsapp/lib/engine';
import { 
  sendMessage as engineSendMessage, 
  fetchMessages as engineFetchMessages, 
  getSessions as engineGetSessions,
  sendStateTyping
} from '@/features/whatsapp/lib/whatsapp-service';

import { realtimeBus } from '@/features/whatsapp/lib/realtime-bus';

export async function POST(req: NextRequest) {
  try {
    const urlSessionId = req.nextUrl.searchParams.get('sessionId') || undefined;
    const body = await req.json();

    console.log(`\n================== [RAW WEBHOOK RECEIVED] ==================`);
    console.log(`URL: ${req.url}`);
    console.log(`Query sessionId: ${urlSessionId}`);
    console.log(`Payload Body:\n${JSON.stringify(body, null, 2)}`);
    console.log(`============================================================\n`);

    const engine = getWhatsAppEngine();
    const event = engine.parseWebhookPayload(body, urlSessionId);

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

    // 1. Strict Multi-Tenant Session Resolution (Match DB Primary Key UUID or unique sessionId)
    let [session] = await db
      .select()
      .from(whatsappSessions)
      .where(
        or(
          eq(whatsappSessions.sessionId, sessionId),
          eq(whatsappSessions.id, sessionId)
        )
      )
      .limit(1);

    if (!session) {
      const allSessions = await db.select().from(whatsappSessions);
      session = allSessions.find(
        (s) => s.sessionId.toLowerCase() === sessionId.toLowerCase() || s.id.toLowerCase() === sessionId.toLowerCase()
      ) as typeof session;

      if (!session) {
        try {
          const engineSessions = await engineGetSessions();
          const matchedEngine = engineSessions.find(
            (es: any) => es.id === sessionId || es.uuid === sessionId || es.name === sessionId
          );
          if (matchedEngine) {
            const matchedKey = (matchedEngine.name || matchedEngine.id).toLowerCase();
            session = allSessions.find(
              (s) => s.sessionId.toLowerCase() === matchedKey || s.id.toLowerCase() === matchedKey
            ) as typeof session;
          }
        } catch (err) {
          console.warn('[Webhook] Engine fallback session lookup error:', err);
        }
      }
    }

    if (!session) {
      console.warn(`[Webhook] Rejected unmapped session "${sessionId}". No matching tenant session found.`);
      return NextResponse.json({ error: 'Session not registered for any organization' }, { status: 404 });
    }

    const orgId = session.organizationId;

    // Update session status in database to CONNECTED if it was recorded as disconnected
    if (session.status !== 'CONNECTED') {
      await db.update(whatsappSessions)
        .set({ status: 'CONNECTED', updatedAt: new Date() })
        .where(eq(whatsappSessions.id, session.id));
    }

    // 2. Resolve or create contact in CRM (Link LID and Phone JIDs)
    const cleanJidNumber = contactWhatsappId.split('@')[0];
    let [contact] = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.organizationId, orgId),
          or(
            eq(contacts.whatsappId, contactWhatsappId),
            like(contacts.whatsappId, `%${cleanJidNumber}%`)
          )
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
      console.log(`[Webhook] AI Auto-Reply skipped: Global AI is disabled for organization ${orgId} (enabled=${aiConfig?.enabled})`);
      return NextResponse.json({ success: true, message: 'AI Auto-Reply is disabled globally for this organization' });
    }

    // 6. Verify human handoff status (contact-level AI toggle strictly scoped to this organization)
    const isAiDisabledForContact = !contact.aiEnabled || (contact.aiEnabled as unknown) === 0;

    // 7. Log incoming message activity in CRM timeline & dispatch to multi-tenant real-time event bus immediately
    await db.insert(activities).values({
      organizationId: orgId,
      contactId: contact.id,
      type: 'MESSAGE_RECEIVED',
      description: `Incoming message: "${incomingMessage.substring(0, 60)}${incomingMessage.length > 60 ? '...' : ''}"`,
    });

    realtimeBus.emitMessageReceived(orgId, session.sessionId, {
      id: { _serialized: `msg-${Date.now()}` },
      from: contactWhatsappId,
      to: session.sessionId,
      fromMe: false,
      body: incomingMessage,
      timestamp: Math.floor(Date.now() / 1000),
      pushName: contact.name || contact.pushName || undefined,
    });

    if (isAiDisabledForContact) {
      console.log(`[Webhook] AI Auto-Reply skipped for contact "${contactWhatsappId}" (AI toggle is OFF for this contact).`);
      return NextResponse.json({ success: true, message: 'AI auto-reply paused (contact AI toggle is OFF)' });
    }

    // 8. Fetch previous chat history from WhatsApp Engine to construct prompt context (up to 30 messages)
    let history: { role: 'user' | 'model'; content: string }[] = [];
    try {
      const messages = await engineFetchMessages(session.sessionId, contactWhatsappId, 30);
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
    console.log(`[Webhook] 🤖 Generating AI Auto-Reply for ${contactWhatsappId} with message: "${incomingMessage}"`);
    const aiResponse = await generateAIResponse(orgId, history, incomingMessage);

    if (aiResponse && aiResponse.trim()) {
      console.log(`[Webhook] 🚀 Sending AI Auto-Reply to ${contactWhatsappId}: "${aiResponse.substring(0, 60)}..."`);

      // Natural typing delay for WhatsApp safety
      try {
        await sendStateTyping(session.sessionId, contactWhatsappId);
        await new Promise((resolve) => setTimeout(resolve, 1500));
      } catch (typingErr) {
        // Non-blocking
      }

      // 10. Send message via WhatsApp Engine
      await engineSendMessage(session.sessionId, contactWhatsappId, aiResponse);

      // 11. Log AI Outgoing message activity in CRM timeline
      await db.insert(activities).values({
        organizationId: orgId,
        contactId: contact.id,
        type: 'MESSAGE_SENT',
        description: `AI Auto-reply sent by ${aiConfig.agentName || 'Riya'}: "${aiResponse.substring(0, 80)}${aiResponse.length > 80 ? '...' : ''}"`,
      });

      realtimeBus.emitMessageSent(orgId, session.sessionId, {
        id: { _serialized: `ai-${Date.now()}` },
        from: session.sessionId,
        to: contactWhatsappId,
        fromMe: true,
        body: aiResponse,
        timestamp: Math.floor(Date.now() / 1000),
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error(`[Webhook] Fatal error processing webhook request:`, err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
