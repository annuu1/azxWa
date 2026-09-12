import { db } from '@/shared/database';
import { 
  leads, 
  contacts, 
  activities, 
  aiSettings, 
  aiActionProposals, 
  whatsappSessions,
  pipelineStages 
} from '@/shared/database/schema';
import { 
  sendMessage as engineSendMessage, 
  sendStateTyping, 
  clearState 
} from '@/features/whatsapp/lib/whatsapp-service';
import { orchestrateLeadIntelligence } from './multi-agent-orchestrator';
import { eq, and, sql, desc } from 'drizzle-orm';
import { realtimeBus } from '@/features/whatsapp/lib/realtime-bus';

let stagnantWorkerRunning = false;

/**
 * Start the Autonomous Stagnant Deal Worker.
 * Scans every 60 seconds for leads inactive in their sales pipeline stage for >48 hours.
 */
export function startStagnantDealWorker(): void {
  if (typeof window !== 'undefined') return;
  if (process.env.CLI_MODE === 'true') return;

  const globalRef = globalThis as any;

  if (globalRef.stagnantDealWorkerInterval) {
    clearInterval(globalRef.stagnantDealWorkerInterval);
    console.log('🔄 Restarting Autonomous Stagnant Deal Worker (Hot Reload)...');
  } else {
    console.log('⚡ Autonomous Stagnant Deal Re-Activator Worker Initialized.');
  }

  // Poll every 60 seconds
  globalRef.stagnantDealWorkerInterval = setInterval(async () => {
    if (stagnantWorkerRunning) return;
    stagnantWorkerRunning = true;

    try {
      await processStagnantDeals();
    } catch (err: any) {
      console.error('[Stagnant Deal Worker Error]:', err.message);
    } finally {
      stagnantWorkerRunning = false;
    }
  }, 60000);
}

/**
 * Main loop: finds and autonomously re-engages stagnant deals.
 */
export async function processStagnantDeals(): Promise<void> {
  const now = Date.now();
  const twoDaysAgo = new Date(now - 48 * 60 * 60 * 1000);

  // 1. Query leads that have been inactive for >= 48 hours
  const candidateLeads = await db
    .select({
      leadId: leads.id,
      orgId: leads.organizationId,
      contactId: leads.contactId,
      stageId: leads.stageId,
      stageName: pipelineStages.name,
      updatedAt: leads.updatedAt,
      createdAt: leads.createdAt,
      contact: {
        id: contacts.id,
        name: contacts.name,
        pushName: contacts.pushName,
        whatsappId: contacts.whatsappId,
        aiEnabled: contacts.aiEnabled,
      },
    })
    .from(leads)
    .innerJoin(pipelineStages, eq(leads.stageId, pipelineStages.id))
    .innerJoin(contacts, eq(leads.contactId, contacts.id))
    .where(
      and(
        sql`(${leads.status} IS NULL OR ${leads.status} NOT IN ('WON', 'LOST', 'CLOSED', 'ARCHIVED'))`,
        sql`(${leads.updatedAt} <= ${twoDaysAgo} OR (${leads.updatedAt} IS NULL AND ${leads.createdAt} <= ${twoDaysAgo}))`
      )
    )
    .limit(15);

  if (candidateLeads.length === 0) return;

  // Filter out terminal stage names (won, lost, closed, etc.)
  const terminalKeywords = ['won', 'lost', 'closed', 'archived', 'unqualified', 'junk', 'dropped'];

  for (const candidate of candidateLeads) {
    try {
      const stageNameLower = (candidate.stageName || '').toLowerCase();
      if (terminalKeywords.some(kw => stageNameLower.includes(kw))) {
        continue;
      }

      // Check contact-level AI toggle
      if (candidate.contact.aiEnabled === false || (candidate.contact.aiEnabled as unknown) === 0) {
        continue;
      }

      if (!candidate.contact.whatsappId || candidate.contact.whatsappId.includes('@g.us')) {
        continue;
      }

      const orgId = candidate.orgId;

      // 2. Fetch AI settings for this organization
      const [settings] = await db
        .select()
        .from(aiSettings)
        .where(eq(aiSettings.organizationId, orgId))
        .limit(1);

      if (!settings || !settings.enabled) {
        continue;
      }

      if (settings.autoFollowupEnabled === false || settings.stagnantReactivationEnabled === false) {
        continue;
      }

      const customHours = settings.stagnantHoursThreshold || 48;
      const customThreshold = new Date(now - customHours * 60 * 60 * 1000);
      const leadLastUpdated = new Date(candidate.updatedAt || candidate.createdAt || now);
      if (leadLastUpdated > customThreshold) {
        continue;
      }

      // 3. Anti-Spam Guardrail: Has any message been sent to this contact in the last 48 hours?
      const recentOutbounds = await db
        .select({ id: activities.id })
        .from(activities)
        .where(
          and(
            eq(activities.contactId, candidate.contactId),
            eq(activities.type, 'MESSAGE_SENT'),
            sql`${activities.createdAt} >= ${new Date(now - 48 * 60 * 60 * 1000)}`
          )
        )
        .limit(1);

      if (recentOutbounds.length > 0) {
        continue;
      }

      // 4. Anti-Fatigue Guardrail: Check how many consecutive stagnant re-activations have been sent without customer reply
      const recentActivities = await db
        .select({ id: activities.id, type: activities.type, description: activities.description })
        .from(activities)
        .where(eq(activities.contactId, candidate.contactId))
        .orderBy(desc(activities.createdAt))
        .limit(6);

      let consecutiveReactivations = 0;
      for (const act of recentActivities) {
        if (act.type === 'MESSAGE_RECEIVED') {
          break; // Customer replied at this point
        }
        if (act.type === 'MESSAGE_SENT' && act.description?.includes('[Autonomous Deal Re-Activation]')) {
          consecutiveReactivations++;
        }
      }

      if (consecutiveReactivations >= 3) {
        // Customer hasn't replied to 3 consecutive re-activations, avoid spamming
        continue;
      }

      // 5. Cluster-Safe Atomic State Locking: Conditionally update leads.updatedAt so no other worker picks it
      const claimTimestamp = new Date();
      const [claimedLead] = await db
        .update(leads)
        .set({ updatedAt: claimTimestamp })
        .where(
          and(
            eq(leads.id, candidate.leadId),
            sql`(${leads.updatedAt} <= ${customThreshold} OR (${leads.updatedAt} IS NULL AND ${leads.createdAt} <= ${customThreshold}))`
          )
        )
        .returning({ id: leads.id });

      if (!claimedLead) {
        // Another cluster worker instance claimed it
        continue;
      }

      const daysInactive = Math.max(2, Math.floor((now - leadLastUpdated.getTime()) / (1000 * 60 * 60 * 24)));
      console.log(`[Stagnant Deal Worker] ⚡ Claimed stagnant lead ${candidate.leadId} (${candidate.contact.whatsappId}, ${daysInactive}d inactive in "${candidate.stageName}"). Analyzing...`);

      // 6. Invoke Multi-Agent Intelligence to synthesize a natural, low-pressure re-engagement message
      const intelResult = await orchestrateLeadIntelligence(orgId, candidate.leadId);
      const messageToSend = intelResult.messageDraft?.messageText || intelResult.proposedAction?.proposedPayload?.message;

      if (!messageToSend || !messageToSend.trim()) {
        console.warn(`[Stagnant Deal Worker] No message draft synthesized for lead ${candidate.leadId}`);
        continue;
      }

      const aiMode = settings.aiMode || 'APPROVAL_REQUIRED';

      if (aiMode === 'AUTONOMOUS') {
        // Find active connected WhatsApp session
        const sessions = await db
          .select()
          .from(whatsappSessions)
          .where(eq(whatsappSessions.organizationId, orgId));

        const activeSession = sessions.find(s => s.status === 'CONNECTED' || s.status === 'READY');

        if (activeSession) {
          // Human-like typing simulation
          try {
            await sendStateTyping(activeSession.sessionId, candidate.contact.whatsappId);
            await new Promise(res => setTimeout(res, 2500));
            await clearState(activeSession.sessionId, candidate.contact.whatsappId);
          } catch (typingErr) {
            // Non-blocking
          }

          // Dispatch message via WhatsApp Engine
          await engineSendMessage(activeSession.sessionId, candidate.contact.whatsappId, messageToSend);

          // Log CRM Activity
          await db.insert(activities).values({
            organizationId: orgId,
            contactId: candidate.contactId,
            type: 'MESSAGE_SENT',
            description: `[Autonomous Deal Re-Activation] Re-engaged stagnant deal (${daysInactive}d inactive in "${candidate.stageName}"): "${messageToSend.substring(0, 90)}..."`,
          });

          // Emit real-time event
          realtimeBus.emitMessageSent(orgId, activeSession.sessionId, {
            id: { _serialized: `stagnant-${Date.now()}` },
            from: activeSession.sessionId,
            to: candidate.contact.whatsappId,
            fromMe: true,
            body: messageToSend,
            timestamp: Math.floor(Date.now() / 1000),
          });

          // Mark any pending action proposal as AUTO_EXECUTED
          await db
            .update(aiActionProposals)
            .set({
              status: 'AUTO_EXECUTED',
              executedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(aiActionProposals.leadId, candidate.leadId),
                eq(aiActionProposals.status, 'PENDING_APPROVAL')
              )
            );

          console.log(`[Stagnant Deal Worker] ✅ Successfully auto-dispatched re-engagement message to ${candidate.contact.whatsappId}`);
        } else {
          console.warn(`[Stagnant Deal Worker] No connected WhatsApp session for org ${orgId}. Logging timeline note.`);
          await db.insert(activities).values({
            organizationId: orgId,
            contactId: candidate.contactId,
            type: 'NOTE_ADDED',
            description: `[Stagnant Re-Activation Paused] Deal is ${daysInactive}d inactive, but WhatsApp session is disconnected.`,
          });
        }
      } else {
        // Co-Pilot Safe Mode (Approval Required)
        console.log(`[Stagnant Deal Worker] 📝 Co-Pilot proposal created for stagnant lead ${candidate.leadId}`);
        await db.insert(aiActionProposals).values({
          organizationId: orgId,
          leadId: candidate.leadId,
          contactId: candidate.contactId,
          actionType: 'FOLLOWUP_MESSAGE',
          status: 'PENDING_APPROVAL',
          confidence: '0.92',
          reasoning: `Deal has been inactive in "${candidate.stageName}" for ${daysInactive} days without customer response. AI drafted a warm re-activation message for your 1-click review.`,
          proposedPayload: JSON.stringify({
            message: messageToSend,
            contactWhatsappId: candidate.contact.whatsappId,
            contactName: candidate.contact.name || candidate.contact.pushName,
            isStagnantReactivation: true,
            daysInactive,
          }),
          executionMode: 'APPROVAL_REQUIRED',
        });

        await db.insert(activities).values({
          organizationId: orgId,
          contactId: candidate.contactId,
          type: 'NOTE_ADDED',
          description: `[AI Re-Activation Proposal Ready] Stagnant deal (${daysInactive}d inactive in "${candidate.stageName}") drafted for 1-click approval.`,
        });
      }

      // Small jitter delay between processing candidates to prevent burst dispatching
      await new Promise(res => setTimeout(res, 2000));
    } catch (candidateErr: any) {
      console.error(`[Stagnant Deal Worker] Error processing candidate lead ${candidate.leadId}:`, candidateErr.message);
    }
  }
}
