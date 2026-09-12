import { db } from '@/shared/database';
import { 
  leads, 
  contacts, 
  activities, 
  aiSettings, 
  leadIntelligence, 
  aiActionProposals, 
  whatsappSessions 
} from '@/shared/database/schema';
import { 
  sendMessage as engineSendMessage, 
  sendStateTyping, 
  clearState 
} from '@/features/whatsapp/lib/whatsapp-service';
import { orchestrateLeadIntelligence } from './multi-agent-orchestrator';
import { eq, and, lte, sql, desc } from 'drizzle-orm';

let followupWorkerRunning = false;

export function startFollowupWorker() {
  if (typeof window !== 'undefined') return;

  if (process.env.CLI_MODE === 'true') {
    return;
  }

  const globalRef = globalThis as any;
  
  if (globalRef.followupWorkerInterval) {
    clearInterval(globalRef.followupWorkerInterval);
    console.log('🔄 Restarting Multi-Agent Follow-Up Worker (Hot Reload)...');
  } else {
    console.log('🤖 Multi-Agent Autonomous Follow-Up Worker Initialized.');
  }

  // Poll every 15 seconds
  globalRef.followupWorkerInterval = setInterval(async () => {
    if (followupWorkerRunning) return;
    followupWorkerRunning = true;

    try {
      await processDueFollowups();
    } catch (err) {
      console.error('[Follow-Up Worker Error]:', err);
    } finally {
      followupWorkerRunning = false;
    }
  }, 15000);
}

export async function processDueFollowups() {
  const now = new Date();

  // Find leads with due follow-up timestamps
  const dueLeads = await db
    .select({
      leadId: leadIntelligence.leadId,
      orgId: leadIntelligence.organizationId,
      contactId: leadIntelligence.contactId,
      nextFollowupAt: leadIntelligence.nextFollowupAt,
      nextSuggestedMessage: leadIntelligence.nextSuggestedMessage,
      summary: leadIntelligence.summary,
      conversationState: leadIntelligence.conversationState,
      contact: {
        id: contacts.id,
        name: contacts.name,
        pushName: contacts.pushName,
        whatsappId: contacts.whatsappId,
      }
    })
    .from(leadIntelligence)
    .innerJoin(contacts, eq(leadIntelligence.contactId, contacts.id))
    .where(
      and(
        lte(leadIntelligence.nextFollowupAt, now),
        sql`${leadIntelligence.nextFollowupAt} IS NOT NULL`
      )
    )
    .limit(10);

  if (dueLeads.length === 0) return;

  console.log(`[Follow-Up Worker] Found ${dueLeads.length} leads due for automated follow-up.`);

  for (const item of dueLeads) {
    try {
      const orgId = item.orgId;

      // 1. Check organization AI execution mode
      const [settings] = await db
        .select()
        .from(aiSettings)
        .where(eq(aiSettings.organizationId, orgId))
        .limit(1);

      const aiMode = settings?.aiMode || 'APPROVAL_REQUIRED';
      const autoEnabled = settings?.autoFollowupEnabled !== false;

      // 2. Fetch or find active WhatsApp session
      const sessions = await db
        .select()
        .from(whatsappSessions)
        .where(eq(whatsappSessions.organizationId, orgId));

      const activeSession = sessions.find(s => s.status === 'CONNECTED' || s.status === 'READY') || sessions[0];

      if (aiMode === 'AUTONOMOUS' && autoEnabled) {
        // Atomic claim: set nextFollowupAt = null conditionally to lock this task for this instance
        const [claimedLead] = await db
          .update(leadIntelligence)
          .set({ nextFollowupAt: null, updatedAt: new Date() })
          .where(
            and(
              eq(leadIntelligence.leadId, item.leadId),
              sql`${leadIntelligence.nextFollowupAt} IS NOT NULL`
            )
          )
          .returning({ leadId: leadIntelligence.leadId });

        if (!claimedLead) {
          // Another worker instance already claimed this lead's follow-up
          continue;
        }

        console.log(`[Follow-Up Worker] Autonomous execution claimed for lead ${item.leadId} (${item.contact.whatsappId})...`);

        // Check if message was already sent in last 10 minutes to prevent loops
        const recentActivities = await db
          .select()
          .from(activities)
          .where(
            and(
              eq(activities.contactId, item.contactId),
              eq(activities.type, 'MESSAGE_SENT'),
              sql`${activities.createdAt} >= ${new Date(Date.now() - 10 * 60 * 1000)}`
            )
          )
          .limit(1);

        if (recentActivities.length > 0) {
          console.log(`[Follow-Up Worker] Skipping lead ${item.leadId}: message sent recently.`);
          continue;
        }

        // Determine message text to send
        let messageToSend = item.nextSuggestedMessage;

        // If no message pre-synthesized, trigger the multi-agent team to generate one
        if (!messageToSend || !messageToSend.trim()) {
          const freshIntel = await orchestrateLeadIntelligence(orgId, item.leadId);
          messageToSend = freshIntel.messageDraft?.messageText || freshIntel.proposedAction?.proposedPayload?.message || '';
        }

        if (messageToSend && messageToSend.trim()) {
          if (activeSession) {
            // Typing indicator simulation
            try {
              await sendStateTyping(activeSession.sessionId, item.contact.whatsappId);
              await new Promise(res => setTimeout(res, 2000));
              await clearState(activeSession.sessionId, item.contact.whatsappId);
            } catch (typingErr) {
              // Non-blocking
            }

            // Send WhatsApp Message via Engine
            await engineSendMessage(activeSession.sessionId, item.contact.whatsappId, messageToSend);

            // Record CRM activity
            await db.insert(activities).values({
              organizationId: orgId,
              contactId: item.contactId,
              type: 'MESSAGE_SENT',
              description: `[Autonomous AI Follow-Up] Message sent: "${messageToSend.slice(0, 100)}..."`,
            });

            console.log(`[Follow-Up Worker] Successfully dispatched autonomous follow-up to ${item.contact.whatsappId}`);
          } else {
            console.warn(`[Follow-Up Worker] No WhatsApp session available for org ${orgId}. Logging note.`);
            await db.insert(activities).values({
              organizationId: orgId,
              contactId: item.contactId,
              type: 'NOTE_ADDED',
              description: `[AI Follow-up Pending] Follow-up was due but WhatsApp session is disconnected.`,
            });
          }

          // Clear nextFollowupAt so it doesn't fire repeatedly
          await db.update(leadIntelligence)
            .set({
              nextFollowupAt: null,
              lastAnalyzedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(leadIntelligence.leadId, item.leadId));

          // Mark any pending proposals as AUTO_EXECUTED
          await db.update(aiActionProposals)
            .set({
              status: 'AUTO_EXECUTED',
              executedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(aiActionProposals.leadId, item.leadId),
                eq(aiActionProposals.status, 'PENDING_APPROVAL')
              )
            );
        }
      } else {
        // APPROVAL REQUIRED (Co-Pilot Mode): Ensure pending action proposal exists
        console.log(`[Follow-Up Worker] Co-Pilot proposal pending for lead ${item.leadId}`);
        
        const existingProposal = await db
          .select()
          .from(aiActionProposals)
          .where(
            and(
              eq(aiActionProposals.leadId, item.leadId),
              eq(aiActionProposals.status, 'PENDING_APPROVAL')
            )
          )
          .limit(1);

        if (existingProposal.length === 0 && item.nextSuggestedMessage) {
          await db.insert(aiActionProposals).values({
            organizationId: orgId,
            leadId: item.leadId,
            contactId: item.contactId,
            actionType: 'FOLLOWUP_MESSAGE',
            status: 'PENDING_APPROVAL',
            confidence: '0.90',
            reasoning: `Scheduled follow-up is due for ${item.contact.name || 'Lead'}. Ready for human review and 1-click execution.`,
            proposedPayload: JSON.stringify({
              message: item.nextSuggestedMessage,
              contactWhatsappId: item.contact.whatsappId,
              contactName: item.contact.name,
            }),
            executionMode: 'APPROVAL_REQUIRED',
          });
        }
      }
    } catch (leadError: any) {
      console.error(`[Follow-Up Worker] Error processing lead ${item.leadId}:`, leadError);
    }
  }
}
