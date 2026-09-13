import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/shared/database';
import { 
  whatsappSessions, 
  contacts, 
  activities, 
  aiSettings, 
  leads, 
  pipelines, 
  pipelineStages 
} from '@/shared/database/schema';
import { eq, and, gte, like, or, asc } from 'drizzle-orm';
import { generateAIResponse, transcribeAudio } from '@/features/ai/lib/ai-service';
import { findBrochureOrDocumentMatch } from '@/features/knowledge-base/lib/kb-service';
import { assignLeadRoundRobin } from '@/features/crm/lib/lead-assignment';
import { queueLeadAnalysis } from '@/features/ai/lib/multi-agent/lead-analysis-queue';
import { getWhatsAppEngine } from '@/features/whatsapp/lib/engine';
import { 
  sendMessage as engineSendMessage, 
  sendMediaMessage as engineSendMediaMessage,
  fetchMessages as engineFetchMessages, 
  getSessions as engineGetSessions,
  sendStateTyping,
  downloadMessageMedia
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
    const { from: contactWhatsappId, isGroup, fromMe } = data;
    let incomingMessage = (data.body || '').trim();

    console.log(`[Webhook] Received event "${eventType}" for session "${sessionId}" from "${contactWhatsappId}"`);

    if (!contactWhatsappId) {
      return NextResponse.json({ success: true, message: 'Message skipped (missing contact ID)' });
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

    // 2. Audio / Voice Note Detection & Groq Whisper Transcription
    const rawMsg = data.raw?.data?.message || data.raw?.data || data.raw?.message || data.raw || {};
    const msgType = (data.raw?.type || rawMsg.type || rawMsg.mimetype || '').toLowerCase();
    const isVoiceNote =
      msgType === 'ptt' ||
      msgType === 'audio' ||
      Boolean(rawMsg.mimetype?.startsWith('audio/')) ||
      Boolean(data.hasMedia && (rawMsg.type === 'ptt' || rawMsg.type === 'audio'));

    if (isVoiceNote) {
      try {
        console.log(`[Webhook] 🎙️ Audio/Voice note detected from ${contactWhatsappId}. Fetching audio buffer...`);
        let audioBuffer: Buffer | null = null;

        // Check if payload includes inline base64
        if (rawMsg.media?.data && typeof rawMsg.media.data === 'string') {
          audioBuffer = Buffer.from(rawMsg.media.data, 'base64');
        } else if (rawMsg.mediaData && typeof rawMsg.mediaData === 'string') {
          audioBuffer = Buffer.from(rawMsg.mediaData, 'base64');
        } else if (typeof rawMsg.body === 'string' && rawMsg.body.startsWith('data:audio/')) {
          const base64Part = rawMsg.body.split(',')[1];
          if (base64Part) audioBuffer = Buffer.from(base64Part, 'base64');
        }

        // If not inline, download from WhatsApp engine
        if (!audioBuffer) {
          const messageId = data.id || rawMsg.id?._serialized || rawMsg.id;
          if (messageId) {
            const mediaRes = await downloadMessageMedia(session.sessionId, contactWhatsappId, messageId);
            if (mediaRes?.buffer) {
              audioBuffer = mediaRes.buffer;
            }
          }
        }

        // Transcribe speech using Groq Whisper (whisper-large-v3)
        if (audioBuffer && audioBuffer.length > 0) {
          const mimeType = rawMsg.mimetype || 'audio/ogg';
          const transcript = await transcribeAudio(audioBuffer, mimeType, orgId);
          if (transcript && transcript.trim()) {
            incomingMessage = transcript.trim();
            console.log(`[Webhook] 🎙️ Successfully transcribed voice note from ${contactWhatsappId}: "${incomingMessage}"`);
          } else {
            incomingMessage = '🎙️ [Voice Note]';
          }
        } else {
          incomingMessage = '🎙️ [Voice Note]';
        }
      } catch (transcribeErr: any) {
        console.warn(`[Webhook] Voice note transcription failed:`, transcribeErr.message);
        incomingMessage = '🎙️ [Voice Note]';
      }
    } else if (!incomingMessage && data.hasMedia) {
      if (msgType === 'image') incomingMessage = '📷 [Photo]';
      else if (msgType === 'video') incomingMessage = '🎥 [Video]';
      else if (msgType === 'document') incomingMessage = '📄 [Document]';
      else incomingMessage = '📎 [Attachment]';
    }

    if (!incomingMessage || !incomingMessage.trim()) {
      return NextResponse.json({ success: true, message: 'Message skipped (empty body)' });
    }

    // 3. Resolve or create contact in CRM (Link LID and Phone JIDs)
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

    // 4. Outgoing message handling: record in CRM without forcing permanent AI block
    if (fromMe) {
      return NextResponse.json({ success: true, message: 'Outgoing message logged' });
    }

    // 5. Ignore group chats for auto-replies
    if (isGroup) {
      return NextResponse.json({ success: true, message: 'Message ignored (Group chat)' });
    }

    // 6. Resolve or auto-create CRM Pipeline Lead for incoming messages & trigger autonomous profiling
    try {
      let leadId: string | null = null;
      const [existingLead] = await db
        .select({ id: leads.id, assignedUserId: leads.assignedUserId })
        .from(leads)
        .where(and(eq(leads.contactId, contact.id), eq(leads.organizationId, orgId)))
        .limit(1);

      if (existingLead) {
        leadId = existingLead.id;
        // If lead was unassigned, assign it via Round-Robin
        if (!existingLead.assignedUserId) {
          await assignLeadRoundRobin(orgId, leadId);
        }
      } else {
        // Auto-enroll in organization's default sales pipeline stage
        const [firstStage] = await db
          .select({ id: pipelineStages.id })
          .from(pipelineStages)
          .innerJoin(pipelines, eq(pipelineStages.pipelineId, pipelines.id))
          .where(eq(pipelines.organizationId, orgId))
          .orderBy(asc(pipelineStages.position))
          .limit(1);

        if (firstStage) {
          const [newLead] = await db.insert(leads).values({
            organizationId: orgId,
            contactId: contact.id,
            stageId: firstStage.id,
            status: 'NEW',
          }).returning({ id: leads.id });
          leadId = newLead.id;

          // Auto-assign new lead evenly to active team members via Balanced Round-Robin
          await assignLeadRoundRobin(orgId, leadId);
        }
      }

      // Trigger debounced autonomous multi-agent lead analysis (120-second silence window)
      if (leadId) {
        queueLeadAnalysis(orgId, leadId, 120000);
      }
    } catch (leadSyncErr: any) {
      console.warn('[Webhook] Lead sync / profiling queue non-blocking error:', leadSyncErr.message);
    }

    // 7. Fetch AI settings to verify if global auto-reply is enabled for organization
    const [aiConfig] = await db
      .select()
      .from(aiSettings)
      .where(eq(aiSettings.organizationId, orgId))
      .limit(1);

    if (!aiConfig || !aiConfig.enabled) {
      console.log(`[Webhook] AI Auto-Reply skipped: Global AI is disabled for organization ${orgId} (enabled=${aiConfig?.enabled})`);
      return NextResponse.json({ success: true, message: 'AI Auto-Reply is disabled globally for this organization' });
    }

    // 8. Verify human handoff status (contact-level AI toggle strictly scoped to this organization)
    const isAiDisabledForContact = !contact.aiEnabled || (contact.aiEnabled as unknown) === 0;

    // 9. Log incoming message activity in CRM timeline & dispatch to multi-tenant real-time event bus immediately
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

    // 10. Fetch previous chat history from WhatsApp Engine to construct prompt context (up to 30 messages)
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

    // 11. Request response from AI Service
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

      // 12. Check if lead requested brochure, price list, or document & auto-dispatch
      try {
        const brochureMatch = await findBrochureOrDocumentMatch(orgId, incomingMessage);
        if (brochureMatch?.mediaUrl) {
          console.log(`[Webhook] 📎 Auto-dispatching brochure/document to ${contactWhatsappId}: ${brochureMatch.mediaUrl}`);
          await engineSendMediaMessage(
            session.sessionId,
            contactWhatsappId,
            brochureMatch.mediaUrl,
            brochureMatch.title ? `📄 ${brochureMatch.title}` : undefined
          );
          await db.insert(activities).values({
            organizationId: orgId,
            contactId: contact.id,
            type: 'MESSAGE_SENT',
            description: `Auto-dispatched brochure/document: "${brochureMatch.title || brochureMatch.mediaUrl}"`,
          });
          // Short pause before conversational reply
          await new Promise((resolve) => setTimeout(resolve, 800));
        }
      } catch (brochureErr: any) {
        console.warn('[Webhook] Brochure auto-dispatch non-blocking error:', brochureErr.message);
      }

      // 13. Send message via WhatsApp Engine
      await engineSendMessage(session.sessionId, contactWhatsappId, aiResponse);

      // 14. Log AI Outgoing message activity in CRM timeline
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
