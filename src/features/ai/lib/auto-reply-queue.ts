import { db } from '@/shared/database';
import { 
  contacts, 
  activities, 
  aiSettings, 
  whatsappSessions 
} from '@/shared/database/schema';
import { eq, and, or, desc } from 'drizzle-orm';
import { generateAIResponse } from './ai-service';
import { findBrochureOrDocumentMatch } from '@/features/knowledge-base/lib/kb-service';
import { 
  sendMessage as engineSendMessage, 
  sendMediaMessage as engineSendMediaMessage,
  fetchMessages as engineFetchMessages, 
  sendStateTyping 
} from '@/features/whatsapp/lib/whatsapp-service';
import { realtimeBus } from '@/features/whatsapp/lib/realtime-bus';

interface AutoReplyJob {
  orgId: string;
  sessionId: string;
  contactWhatsappId: string;
  contactId: string;
  messages: string[];
  timer: NodeJS.Timeout;
  scheduledAt: number;
}

// Global reference so hot reloads or multiple imports share the same debounce map
const globalRef = globalThis as any;
if (!globalRef.autoReplyDebounceMap) {
  globalRef.autoReplyDebounceMap = new Map<string, AutoReplyJob>();
}

const jobsMap: Map<string, AutoReplyJob> = globalRef.autoReplyDebounceMap;

/**
 * Retrieve hybrid chat history from both the WhatsApp engine and CRM activities.
 * If the engine has fewer than 2 messages (e.g. after engine restart or cold cache),
 * CRM activities table is queried as a reliable fallback.
 */
export async function getHybridChatHistory(
  orgId: string,
  sessionId: string,
  contactWhatsappId: string,
  contactId: string,
  limit = 25
): Promise<{ role: 'user' | 'model'; content: string }[]> {
  let history: { role: 'user' | 'model'; content: string }[] = [];

  // 1. Try WhatsApp Engine first
  try {
    const messages = await engineFetchMessages(sessionId, contactWhatsappId, limit);
    if (messages && messages.length > 0) {
      history = messages
        .filter((m: any) => Boolean(m.body && typeof m.body === 'string' && m.body.trim()))
        .slice(-limit)
        .map((m: any) => ({
          role: (m.fromMe || m.isFromMe ? 'model' : 'user') as 'user' | 'model',
          content: m.body as string,
        }));
    }
  } catch (err: any) {
    console.warn(`[AutoReplyQueue] Engine fetchMessages warning for ${contactWhatsappId}:`, err.message);
  }

  // 2. Fall back to CRM activities table if engine returned insufficient history
  if (history.length < 2 && contactId) {
    try {
      const crmActivities = await db
        .select({
          type: activities.type,
          description: activities.description,
          createdAt: activities.createdAt,
        })
        .from(activities)
        .where(
          and(
            eq(activities.organizationId, orgId),
            eq(activities.contactId, contactId),
            or(
              eq(activities.type, 'MESSAGE_RECEIVED'),
              eq(activities.type, 'MESSAGE_SENT')
            )
          )
        )
        .orderBy(desc(activities.createdAt))
        .limit(limit);

      if (crmActivities.length > 0) {
        const crmHistory = crmActivities
          .reverse()
          .map((act) => {
            const isSent = act.type === 'MESSAGE_SENT';
            let text = act.description || '';
            const quoteMatch = text.match(/"([^"]+)"/);
            if (quoteMatch && quoteMatch[1]) {
              text = quoteMatch[1];
            } else {
              text = text
                .replace(/^Incoming message:\s*/i, '')
                .replace(/^AI Auto-reply sent by [^:]+:\s*/i, '')
                .replace(/^Instant Ad Welcome WhatsApp sent by [^:]+:\s*/i, '')
                .replace(/^Auto-dispatched [^:]+:\s*/i, '');
            }
            return {
              role: (isSent ? 'model' : 'user') as 'user' | 'model',
              content: text.trim(),
            };
          })
          .filter((h) => h.content.length > 0);

        if (crmHistory.length > history.length) {
          console.log(`[AutoReplyQueue] Loaded ${crmHistory.length} messages from CRM activity history fallback for ${contactWhatsappId}`);
          history = crmHistory;
        }
      }
    } catch (crmErr: any) {
      console.warn(`[AutoReplyQueue] CRM history fallback error:`, crmErr.message);
    }
  }

  return history;
}

/**
 * Queue an incoming message for AI Auto-Reply with a 25-second burst debouncing window.
 * If the contact sends additional messages within 25 seconds, the messages are accumulated
 * and the timer resets, ensuring the AI replies to the complete conversational thought.
 */
export function queueAutoReply(params: {
  orgId: string;
  sessionId: string;
  contactWhatsappId: string;
  contactId: string;
  incomingMessage: string;
  delayMs?: number;
}): void {
  const { orgId, sessionId, contactWhatsappId, contactId, incomingMessage } = params;
  const delayMs = params.delayMs ?? 25000; // Default 25 seconds
  const key = `${orgId}:${contactWhatsappId}`;

  // If a pending job exists for this contact, cancel existing timer & append message to burst buffer
  if (jobsMap.has(key)) {
    const existingJob = jobsMap.get(key)!;
    clearTimeout(existingJob.timer);

    if (incomingMessage && incomingMessage.trim()) {
      existingJob.messages.push(incomingMessage.trim());
    }

    existingJob.scheduledAt = Date.now();
    existingJob.timer = setTimeout(() => {
      executeAutoReply(key);
    }, delayMs);

    console.log(`[AutoReplyQueue] ⏳ Appended message to burst buffer for ${contactWhatsappId}. Total burst messages: ${existingJob.messages.length}. Reset ${delayMs / 1000}s debounce window.`);
    return;
  }

  // Otherwise, start a fresh 25-second debounce window
  const newMessages = incomingMessage && incomingMessage.trim() ? [incomingMessage.trim()] : [];
  const timer = setTimeout(() => {
    executeAutoReply(key);
  }, delayMs);

  jobsMap.set(key, {
    orgId,
    sessionId,
    contactWhatsappId,
    contactId,
    messages: newMessages,
    timer,
    scheduledAt: Date.now(),
  });

  console.log(`[AutoReplyQueue] ⏳ Scheduled AI Auto-Reply for ${contactWhatsappId} in ${delayMs / 1000}s debounce window.`);
}

/**
 * Cancel a pending auto-reply (e.g. when a human agent replies from inbox or phone)
 */
export function cancelPendingAutoReply(orgId: string, contactWhatsappId: string): boolean {
  const key = `${orgId}:${contactWhatsappId}`;
  if (jobsMap.has(key)) {
    const job = jobsMap.get(key)!;
    clearTimeout(job.timer);
    jobsMap.delete(key);
    console.log(`[AutoReplyQueue] 🛑 Cancelled pending AI auto-reply for ${contactWhatsappId} (human agent intervention)`);
    return true;
  }
  return false;
}

/**
 * Internal execution after the 25-second debounce window elapses
 */
async function executeAutoReply(key: string): Promise<void> {
  const job = jobsMap.get(key);
  if (!job) return;
  jobsMap.delete(key);

  const { orgId, sessionId, contactWhatsappId, contactId, messages } = job;
  if (messages.length === 0) return;

  try {
    // 1. Verify contact-level AI toggle is still enabled
    const [contact] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, contactId), eq(contacts.organizationId, orgId)))
      .limit(1);

    if (!contact || !contact.aiEnabled || (contact.aiEnabled as unknown) === 0) {
      console.log(`[AutoReplyQueue] 🛑 Auto-reply cancelled for ${contactWhatsappId}: Contact AI toggle is OFF.`);
      return;
    }

    // 2. Verify global AI settings for organization
    const [aiConfig] = await db
      .select()
      .from(aiSettings)
      .where(eq(aiSettings.organizationId, orgId))
      .limit(1);

    if (!aiConfig || !aiConfig.enabled) {
      console.log(`[AutoReplyQueue] 🛑 Auto-reply cancelled: Global AI is disabled for organization ${orgId}.`);
      return;
    }

    // 3. Combine burst messages into a unified conversational query
    const combinedMessage = messages.join('\n');
    console.log(`[AutoReplyQueue] 🤖 Generating AI auto-reply for ${contactWhatsappId} (${messages.length} burst message${messages.length > 1 ? 's' : ''}):\n"${combinedMessage}"`);

    // 4. Retrieve hybrid chat history (Engine + CRM activity fallback)
    const history = await getHybridChatHistory(orgId, sessionId, contactWhatsappId, contactId, 25);

    // 5. Check if customer requested a brochure, floor plan, or document & auto-dispatch
    try {
      const brochureMatch = await findBrochureOrDocumentMatch(orgId, combinedMessage);
      if (brochureMatch?.mediaUrl) {
        console.log(`[AutoReplyQueue] 📎 Auto-dispatching brochure/document to ${contactWhatsappId}: ${brochureMatch.mediaUrl}`);
        await engineSendMediaMessage(
          sessionId,
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
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    } catch (brochureErr: any) {
      console.warn('[AutoReplyQueue] Brochure auto-dispatch error:', brochureErr.message);
    }

    // 6. Generate AI completion
    const aiResponse = await generateAIResponse(orgId, history, combinedMessage);
    if (!aiResponse || !aiResponse.trim()) {
      console.log(`[AutoReplyQueue] AI returned empty response for ${contactWhatsappId}`);
      return;
    }

    // 7. Natural typing delay for WhatsApp safety
    try {
      await sendStateTyping(sessionId, contactWhatsappId);
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch {}

    // 8. Send WhatsApp Message
    console.log(`[AutoReplyQueue] 🚀 Dispatching AI Auto-Reply to ${contactWhatsappId}: "${aiResponse.substring(0, 60)}..."`);
    await engineSendMessage(sessionId, contactWhatsappId, aiResponse);

    // 9. Log outbound message in CRM activity timeline
    await db.insert(activities).values({
      organizationId: orgId,
      contactId: contact.id,
      type: 'MESSAGE_SENT',
      description: `AI Auto-reply sent by ${aiConfig.agentName || 'Riya'}: "${aiResponse.substring(0, 80)}${aiResponse.length > 80 ? '...' : ''}"`,
    });

    // 10. Broadcast to realtime event bus for live inbox synchronization
    realtimeBus.emitMessageSent(orgId, sessionId, {
      id: { _serialized: `ai-${Date.now()}` },
      from: sessionId,
      to: contactWhatsappId,
      fromMe: true,
      body: aiResponse,
      timestamp: Math.floor(Date.now() / 1000),
    });

    console.log(`[AutoReplyQueue] ✅ AI Auto-Reply completed successfully for ${contactWhatsappId}`);
  } catch (err: any) {
    console.error(`[AutoReplyQueue] ❌ Error executing auto-reply for ${contactWhatsappId}:`, err.message);
  }
}
