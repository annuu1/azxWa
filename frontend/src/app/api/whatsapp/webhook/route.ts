import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/shared/database';
import { whatsappSessions, contacts, activities, aiSettings } from '@/shared/database/schema';
import { eq, and, sql } from 'drizzle-orm';
import { generateAIResponse } from '@/features/ai/lib/ai-service';
import { sendMessage as engineSendMessage, fetchMessages as engineFetchMessages } from '@/features/whatsapp/lib/whatsapp-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const dataType = body.dataType || body.event;
    const { data, sessionId } = body;

    // Log the event name and session
    console.log(`[Webhook] Received event/dataType: "${dataType}" for session: "${sessionId}"`);

    if (!dataType) {
      return NextResponse.json({ error: 'Payload event/dataType is missing' }, { status: 400 });
    }

    if (dataType !== 'message' && dataType !== 'message_create') {
      return NextResponse.json({ success: true, message: `Ignored event type: ${dataType}` });
    }

    if (!data) {
      return NextResponse.json({ error: 'Payload data is missing' }, { status: 400 });
    }

    // Unpack message structure. In wwebjs-api, data.message contains the message details
    const msg = data.message || data;
    const incomingMessage = msg.body;
    const isGroup = msg.isGroup || false;
    const fromMe = msg.fromMe || false;

    // JID handling: remote user JID is msg.to for outgoing, msg.from for incoming
    const contactWhatsappId = fromMe ? msg.to : msg.from;

    if (!incomingMessage || !contactWhatsappId) {
      return NextResponse.json({ success: true, message: 'Message skipped (empty body or contact ID)' });
    }

    // Double trigger prevention:
    // wwebjs-api fires 'message' (dataType: 'message') for incoming messages,
    // and also 'message_create' (dataType: 'message_create') for both incoming and outgoing messages.
    // To avoid double AI replies:
    // - We handle incoming messages ONLY on the 'message' event.
    // - We handle outgoing messages ONLY on 'message_create' when fromMe is true (for human handoff).
    if (dataType === 'message_create' && !fromMe) {
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
      
      // Try case-insensitive match
      const caseInsensitiveMatch = allSessions.find(
        (s) => s.sessionId.toLowerCase() === sessionId.toLowerCase()
      );
      
      if (caseInsensitiveMatch) {
        session = caseInsensitiveMatch;
      } else if (allSessions.length > 0) {
        // Fallback to first session, preferably connected
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

    // 2. Resolve or create contact in CRM
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
          name: msg.pushName || msg.name || contactWhatsappId.split('@')[0],
          pushName: msg.pushName || null,
          isGroup: isGroup,
          aiEnabled: true,
        })
        .returning();
      console.log(`[Webhook] Created new CRM contact: ${contact.name} (${contactWhatsappId})`);
    }

    // 3. Human Handoff: If the message is sent by me (outgoing manual message), deactivate the AI for that contact
    if (fromMe) {
      if (contact.aiEnabled) {
        await db
          .update(contacts)
          .set({ aiEnabled: false })
          .where(eq(contacts.id, contact.id));
        console.log(`[Webhook] Outgoing manual message detected. Deactivated AI auto-reply for contact "${contactWhatsappId}"`);
      }
      return NextResponse.json({ success: true, message: 'Self-message processed (AI auto-reply disabled for contact)' });
    }

    // 4. Ignore group chats for auto-replies
    if (isGroup) {
      return NextResponse.json({ success: true, message: 'Message ignored (Group chat)' });
    }

    // 5. Fetch AI settings to verify if global auto-reply is enabled
    const [aiConfig] = await db
      .select()
      .from(aiSettings)
      .where(eq(aiSettings.organizationId, orgId))
      .limit(1);

    if (!aiConfig || !aiConfig.enabled) {
      return NextResponse.json({ success: true, message: 'AI Auto-Reply is disabled globally for this organization' });
    }

    // 6. Verify human handoff status (contact-level block)
    if (!contact.aiEnabled) {
      console.log(`[Webhook] AI Auto-Reply skipped for contact "${contactWhatsappId}" (Human agent handoff is active).`);
      return NextResponse.json({ success: true, message: 'AI auto-reply paused (human handoff active)' });
    }

    // 7. Log incoming message activity in CRM timeline
    await db.insert(activities).values({
      organizationId: orgId,
      contactId: contact.id,
      type: 'MESSAGE_RECEIVED',
      description: `Incoming message: "${incomingMessage.substring(0, 60)}${incomingMessage.length > 60 ? '...' : ''}"`,
    });

    // 8. Fetch previous chat history from WhatsApp Engine to construct prompt context
    let history: { role: 'user' | 'model'; content: string }[] = [];
    try {
      const messages = await engineFetchMessages(sessionId, contactWhatsappId, 8);
      if (messages && messages.length > 0) {
        history = messages
          .filter((m: any) => m.body && m.type === 'chat')
          .map((m: any) => ({
            role: m.fromMe ? 'model' : 'user',
            content: m.body,
          }));
      }
    } catch (historyErr: any) {
      console.warn(`[Webhook] Failed to fetch chat history from engine:`, historyErr.message);
    }

    // 9. Request response from AI Service
    const aiResponse = await generateAIResponse(orgId, history, incomingMessage);

    if (aiResponse) {
      console.log(`[Webhook] Sending AI Auto-Reply to ${contactWhatsappId}: "${aiResponse.substring(0, 45)}..."`);

      // 10. Send message via WhatsApp Engine
      await engineSendMessage(sessionId, contactWhatsappId, aiResponse);

      // 11. Log AI Outgoing message activity in CRM timeline
      await db.insert(activities).values({
        organizationId: orgId,
        contactId: contact.id,
        type: 'MESSAGE_SENT',
        description: `AI Auto-reply: "${aiResponse.substring(0, 60)}${aiResponse.length > 60 ? '...' : ''}"`,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error(`[Webhook] Fatal error processing webhook request:`, err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
