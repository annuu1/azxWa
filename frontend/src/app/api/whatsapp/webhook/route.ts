import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/shared/database';
import { whatsappSessions, contacts, activities, aiSettings } from '@/shared/database/schema';
import { eq, and, sql } from 'drizzle-orm';
import { generateAIResponse } from '@/features/ai/lib/ai-service';
import { sendMessage as engineSendMessage, fetchMessages as engineFetchMessages } from '@/features/whatsapp/lib/whatsapp-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event, data, sessionId } = body;

    // Log the event name and session
    console.log(`[Webhook] Received event: "${event}" for session: "${sessionId}"`);

    if (event !== 'message') {
      return NextResponse.json({ success: true, message: `Ignored event type: ${event}` });
    }

    if (!data) {
      return NextResponse.json({ error: 'Payload data is missing' }, { status: 400 });
    }

    const incomingMessage = data.body;
    const senderWhatsappId = data.from;
    const isGroup = data.isGroup || false;
    const fromMe = data.fromMe || false;

    // Ignore self-messages and group chats for auto-replies
    if (fromMe || isGroup) {
      return NextResponse.json({ success: true, message: 'Message ignored (Self or Group chat)' });
    }

    if (!incomingMessage || !senderWhatsappId) {
      return NextResponse.json({ success: true, message: 'Message skipped (empty body or sender)' });
    }

    // 1. Resolve WhatsApp session to find Organization ID
    const [session] = await db
      .select()
      .from(whatsappSessions)
      .where(eq(whatsappSessions.sessionId, sessionId))
      .limit(1);

    if (!session) {
      console.warn(`[Webhook] WhatsApp Session ID "${sessionId}" not matched in database.`);
      return NextResponse.json({ error: 'Associated session not found' }, { status: 404 });
    }

    const orgId = session.organizationId;

    // 2. Fetch AI settings to verify if global auto-reply is enabled
    const [aiConfig] = await db
      .select()
      .from(aiSettings)
      .where(eq(aiSettings.organizationId, orgId))
      .limit(1);

    if (!aiConfig || !aiConfig.enabled) {
      return NextResponse.json({ success: true, message: 'AI Auto-Reply is disabled globally for this organization' });
    }

    // 3. Resolve or create contact in CRM
    let [contact] = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.whatsappId, senderWhatsappId),
          eq(contacts.organizationId, orgId)
        )
      )
      .limit(1);

    if (!contact) {
      [contact] = await db
        .insert(contacts)
        .values({
          organizationId: orgId,
          whatsappId: senderWhatsappId,
          name: data.pushName || data.name || senderWhatsappId.split('@')[0],
          pushName: data.pushName || null,
          isGroup: false,
          aiEnabled: true,
        })
        .returning();
      console.log(`[Webhook] Created new CRM contact: ${contact.name} (${senderWhatsappId})`);
    }

    // 4. Verify human handoff status (contact-level block)
    if (!contact.aiEnabled) {
      console.log(`[Webhook] AI Auto-Reply skipped for contact "${senderWhatsappId}" (Human agent handoff is active).`);
      return NextResponse.json({ success: true, message: 'AI auto-reply paused (human handoff active)' });
    }

    // 5. Log incoming message activity in CRM timeline
    await db.insert(activities).values({
      organizationId: orgId,
      contactId: contact.id,
      type: 'MESSAGE_RECEIVED',
      description: `Incoming message: "${incomingMessage.substring(0, 60)}${incomingMessage.length > 60 ? '...' : ''}"`,
    });

    // 6. Fetch previous chat history from WhatsApp Engine to construct prompt context
    let history: { role: 'user' | 'model'; content: string }[] = [];
    try {
      const messages = await engineFetchMessages(sessionId, senderWhatsappId, 8);
      if (messages && messages.length > 0) {
        history = messages
          .filter((msg: any) => msg.body && msg.type === 'chat')
          .map((msg: any) => ({
            role: msg.fromMe ? 'model' : 'user',
            content: msg.body,
          }));
      }
    } catch (historyErr: any) {
      console.warn(`[Webhook] Failed to fetch chat history from engine:`, historyErr.message);
    }

    // 7. Request response from AI Service
    const aiResponse = await generateAIResponse(orgId, history, incomingMessage);

    if (aiResponse) {
      console.log(`[Webhook] Sending AI Auto-Reply to ${senderWhatsappId}: "${aiResponse.substring(0, 45)}..."`);

      // 8. Send message via WhatsApp Engine
      await engineSendMessage(sessionId, senderWhatsappId, aiResponse);

      // 9. Log AI Outgoing message activity in CRM timeline
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
