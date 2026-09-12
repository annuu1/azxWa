'use server';

import { db } from '@/shared/database';
import { 
  leads, 
  contacts, 
  notes, 
  activities, 
  aiSettings, 
  leadIntelligence, 
  aiActionProposals, 
  pipelineStages,
  whatsappSessions 
} from '@/shared/database/schema';
import { eq, and, desc, asc, inArray, sql, isNotNull } from 'drizzle-orm';
import { getSession } from '@/features/auth/lib/auth-utils';
import { orchestrateLeadIntelligence } from '../lib/multi-agent/multi-agent-orchestrator';
import { sendMessage } from '@/features/whatsapp/lib/whatsapp-service';
import { revalidatePath } from 'next/cache';

// 1. Analyze single lead with Multi-Agent team
export async function analyzeLeadWithAi(leadId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  const orgId = session.organizationId as string;

  try {
    const result = await orchestrateLeadIntelligence(orgId, leadId);
    revalidatePath('/dashboard/crm');
    revalidatePath('/dashboard/inbox');
    return { success: true, intelligence: result };
  } catch (error: any) {
    console.error('[analyzeLeadWithAi error]:', error);
    return { success: false, error: error.message };
  }
}

// 2. Batch analyze all active leads in CRM Pipeline
export async function analyzeAllPipelineLeadsAction() {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  const orgId = session.organizationId as string;

  try {
    const activeLeads = await db
      .select({ id: leads.id })
      .from(leads)
      .where(eq(leads.organizationId, orgId))
      .limit(20);

    const results = [];
    for (const lead of activeLeads) {
      try {
        const res = await orchestrateLeadIntelligence(orgId, lead.id);
        results.push({ leadId: lead.id, success: true, score: res.profile.leadScore });
      } catch (e: any) {
        results.push({ leadId: lead.id, success: false, error: e.message });
      }
    }

    revalidatePath('/dashboard/crm');
    return { success: true, analyzedCount: results.length, results };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// 3. Add human note and immediately trigger AI re-analysis
export async function addHumanNoteAndReanalyze(contactId: string, leadId: string, noteContent: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  const orgId = session.organizationId as string;
  const userId = session.userId as string;

  if (!noteContent || !noteContent.trim()) {
    return { success: false, error: 'Note content cannot be empty' };
  }

  try {
    // Insert Human Note
    const [createdNote] = await db.insert(notes).values({
      organizationId: orgId,
      contactId,
      userId,
      content: noteContent.trim(),
    }).returning();

    // Log Activity
    await db.insert(activities).values({
      organizationId: orgId,
      contactId,
      userId,
      type: 'NOTE_ADDED',
      description: `Human sales note added: "${noteContent.trim().slice(0, 80)}..."`,
    });

    // Trigger AI Multi-Agent Re-Analysis with the new note context
    let intelligence = null;
    if (leadId) {
      intelligence = await orchestrateLeadIntelligence(orgId, leadId);
    }

    revalidatePath('/dashboard/crm');
    revalidatePath('/dashboard/inbox');
    return { success: true, note: createdNote, intelligence };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// 4. Fetch Lead Intelligence & Proposals for a lead
export async function getLeadIntelligenceAction(leadId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  const orgId = session.organizationId as string;

  try {
    const [intel] = await db
      .select()
      .from(leadIntelligence)
      .where(and(eq(leadIntelligence.leadId, leadId), eq(leadIntelligence.organizationId, orgId)))
      .limit(1);

    const proposals = await db
      .select()
      .from(aiActionProposals)
      .where(and(eq(aiActionProposals.leadId, leadId), eq(aiActionProposals.organizationId, orgId)))
      .orderBy(desc(aiActionProposals.createdAt))
      .limit(5);

    return { 
      success: true, 
      intelligence: intel || null, 
      proposals: proposals || [] 
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// 5. Approve & Execute AI Action Proposal (Co-Pilot approval click)
export async function approveProposalAction(proposalId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  const orgId = session.organizationId as string;
  const userId = session.userId as string;

  try {
    const [proposal] = await db
      .select()
      .from(aiActionProposals)
      .where(and(eq(aiActionProposals.id, proposalId), eq(aiActionProposals.organizationId, orgId)))
      .limit(1);

    if (!proposal) throw new Error('Proposal not found');
    if (proposal.status === 'APPROVED' || proposal.status === 'EXECUTED') {
      return { success: true, message: 'Proposal already executed' };
    }

    const payload = JSON.parse(proposal.proposedPayload || '{}');

    // Execute Tool 1: Stage Transition
    if (payload.targetStageId) {
      await db.update(leads).set({ stageId: payload.targetStageId, updatedAt: new Date() }).where(eq(leads.id, proposal.leadId));
      await db.insert(activities).values({
        organizationId: orgId,
        contactId: proposal.contactId,
        userId,
        type: 'LEAD_STAGE_CHANGED',
        description: `Lead stage updated to "${payload.targetStageName || 'Qualified'}" approved by sales rep`,
      });
    }

    // Execute Tool 2: Send WhatsApp Follow-up Message immediately if requested
    if (payload.message) {
      const [contact] = await db.select().from(contacts).where(eq(contacts.id, proposal.contactId)).limit(1);
      const [activeSession] = await db.select().from(whatsappSessions).where(and(eq(whatsappSessions.organizationId, orgId), eq(whatsappSessions.status, 'CONNECTED'))).limit(1);

      if (contact && activeSession) {
        await sendMessage(activeSession.sessionId, contact.whatsappId, payload.message);
        await db.insert(activities).values({
          organizationId: orgId,
          contactId: proposal.contactId,
          userId,
          type: 'MESSAGE_SENT',
          description: `AI Approved follow-up message sent: "${payload.message.slice(0, 60)}..."`,
        });
      }
    }

    // Mark proposal as APPROVED & EXECUTED
    await db.update(aiActionProposals).set({
      status: 'APPROVED',
      approvedById: userId,
      executedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(aiActionProposals.id, proposalId));

    revalidatePath('/dashboard/crm');
    revalidatePath('/dashboard/inbox');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// 6. Reject Proposal
export async function rejectProposalAction(proposalId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  const orgId = session.organizationId as string;

  try {
    await db.update(aiActionProposals).set({
      status: 'REJECTED',
      updatedAt: new Date(),
    }).where(and(eq(aiActionProposals.id, proposalId), eq(aiActionProposals.organizationId, orgId)));

    revalidatePath('/dashboard/crm');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// 7. Toggle AI Mode (Autonomous vs Approval Required)
export async function toggleAiExecutionModeAction(mode: 'AUTONOMOUS' | 'APPROVAL_REQUIRED') {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  const orgId = session.organizationId as string;

  try {
    const existing = await db.select().from(aiSettings).where(eq(aiSettings.organizationId, orgId)).limit(1);
    if (existing.length > 0) {
      await db.update(aiSettings).set({ aiMode: mode, updatedAt: new Date() }).where(eq(aiSettings.organizationId, orgId));
    } else {
      await db.insert(aiSettings).values({ organizationId: orgId, aiMode: mode });
    }
    revalidatePath('/dashboard/crm');
    revalidatePath('/dashboard/ai');
    return { success: true, mode };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// 8. Get AI Mode Setting
export async function getAiModeSettingAction() {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  const orgId = session.organizationId as string;

  try {
    const [settings] = await db.select().from(aiSettings).where(eq(aiSettings.organizationId, orgId)).limit(1);
    return { 
      success: true, 
      aiMode: (settings?.aiMode as 'AUTONOMOUS' | 'APPROVAL_REQUIRED') || 'APPROVAL_REQUIRED',
      autoFollowupEnabled: Boolean(settings?.autoFollowupEnabled !== false),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// 9. Manually Trigger Follow-Up Worker Loop
export async function triggerFollowupWorkerAction() {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  try {
    const { processDueFollowups } = await import('../lib/multi-agent/followup-worker');
    await processDueFollowups();
    revalidatePath('/dashboard/crm');
    revalidatePath('/dashboard/inbox');
    revalidatePath('/dashboard/ai');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// 10. Fetch Complete AI Activity, Proposals, Follow-ups, and Profiles for the AI Command Center
export async function getAiDashboardOverview() {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  const orgId = session.organizationId as string;

  try {
    // 1. Fetch AI-related activities
    const aiActivities = await db
      .select({
        id: activities.id,
        type: activities.type,
        description: activities.description,
        createdAt: activities.createdAt,
        contact: {
          id: contacts.id,
          name: contacts.name,
          pushName: contacts.pushName,
          whatsappId: contacts.whatsappId,
        }
      })
      .from(activities)
      .innerJoin(contacts, eq(activities.contactId, contacts.id))
      .where(eq(activities.organizationId, orgId))
      .orderBy(desc(activities.createdAt))
      .limit(50);

    // 2. Fetch all proposals with contact info
    const proposals = await db
      .select({
        id: aiActionProposals.id,
        leadId: aiActionProposals.leadId,
        contactId: aiActionProposals.contactId,
        actionType: aiActionProposals.actionType,
        status: aiActionProposals.status,
        confidence: aiActionProposals.confidence,
        reasoning: aiActionProposals.reasoning,
        proposedPayload: aiActionProposals.proposedPayload,
        executionMode: aiActionProposals.executionMode,
        executedAt: aiActionProposals.executedAt,
        createdAt: aiActionProposals.createdAt,
        contact: {
          id: contacts.id,
          name: contacts.name,
          pushName: contacts.pushName,
          whatsappId: contacts.whatsappId,
        }
      })
      .from(aiActionProposals)
      .innerJoin(contacts, eq(aiActionProposals.contactId, contacts.id))
      .where(eq(aiActionProposals.organizationId, orgId))
      .orderBy(desc(aiActionProposals.createdAt))
      .limit(100);

    // 3. Fetch scheduled follow-ups
    const scheduledFollowups = await db
      .select({
        leadId: leadIntelligence.leadId,
        contactId: leadIntelligence.contactId,
        summary: leadIntelligence.summary,
        leadScore: leadIntelligence.leadScore,
        buyingIntent: leadIntelligence.buyingIntent,
        sentiment: leadIntelligence.sentiment,
        conversationState: leadIntelligence.conversationState,
        nextFollowupAt: leadIntelligence.nextFollowupAt,
        nextFollowupReason: leadIntelligence.nextFollowupReason,
        nextSuggestedMessage: leadIntelligence.nextSuggestedMessage,
        lastAnalyzedAt: leadIntelligence.lastAnalyzedAt,
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
          eq(leadIntelligence.organizationId, orgId),
          sql`${leadIntelligence.nextFollowupAt} IS NOT NULL`
        )
      )
      .orderBy(asc(leadIntelligence.nextFollowupAt));

    // 4. Fetch all Lead Intelligence Profiles
    const leadProfiles = await db
      .select({
        id: leadIntelligence.id,
        leadId: leadIntelligence.leadId,
        contactId: leadIntelligence.contactId,
        summary: leadIntelligence.summary,
        buyerPersona: leadIntelligence.buyerPersona,
        buyingIntent: leadIntelligence.buyingIntent,
        leadScore: leadIntelligence.leadScore,
        sentiment: leadIntelligence.sentiment,
        budget: leadIntelligence.budget,
        need: leadIntelligence.need,
        timeline: leadIntelligence.timeline,
        painPoints: leadIntelligence.painPoints,
        objections: leadIntelligence.objections,
        conversationState: leadIntelligence.conversationState,
        confidence: leadIntelligence.confidence,
        nextFollowupAt: leadIntelligence.nextFollowupAt,
        nextSuggestedMessage: leadIntelligence.nextSuggestedMessage,
        lastAnalyzedAt: leadIntelligence.lastAnalyzedAt,
        contact: {
          id: contacts.id,
          name: contacts.name,
          pushName: contacts.pushName,
          whatsappId: contacts.whatsappId,
        }
      })
      .from(leadIntelligence)
      .innerJoin(contacts, eq(leadIntelligence.contactId, contacts.id))
      .where(eq(leadIntelligence.organizationId, orgId))
      .orderBy(desc(leadIntelligence.lastAnalyzedAt))
      .limit(100);

    // 5. Calculate statistics
    const totalAnalyzed = leadProfiles.length;
    const avgScore = totalAnalyzed > 0 
      ? Math.round(leadProfiles.reduce((acc, curr) => acc + (curr.leadScore || 0), 0) / totalAnalyzed) 
      : 0;
    const pendingProposalsCount = proposals.filter(p => p.status === 'PENDING_APPROVAL').length;
    const autoExecutedCount = proposals.filter(p => p.status === 'AUTO_EXECUTED' || p.status === 'APPROVED').length;
    const dueFollowupsCount = scheduledFollowups.filter(f => f.nextFollowupAt && new Date(f.nextFollowupAt) <= new Date()).length;

    // 6. Settings
    const [settings] = await db.select().from(aiSettings).where(eq(aiSettings.organizationId, orgId)).limit(1);

    // 7. Pipeline Stages
    const stages = await db.select().from(pipelineStages).where(eq(pipelineStages.organizationId, orgId)).orderBy(asc(pipelineStages.order));

    // 8. Active WhatsApp Session
    const sessions = await db.select().from(whatsappSessions).where(eq(whatsappSessions.organizationId, orgId));
    const activeSession = sessions.find(s => s.status === 'CONNECTED' || s.status === 'READY') || sessions[0] || null;

    return {
      success: true,
      stats: {
        totalAnalyzed,
        avgScore,
        pendingProposalsCount,
        autoExecutedCount,
        dueFollowupsCount,
        scheduledFollowupsCount: scheduledFollowups.length,
      },
      aiActivities,
      proposals,
      scheduledFollowups,
      leadProfiles,
      stages,
      aiMode: (settings?.aiMode as 'AUTONOMOUS' | 'APPROVAL_REQUIRED') || 'APPROVAL_REQUIRED',
      autoFollowupEnabled: Boolean(settings?.autoFollowupEnabled !== false),
      activeSession: activeSession ? { id: activeSession.id, sessionId: activeSession.sessionId, status: activeSession.status } : null,
    };
  } catch (error: any) {
    console.error('[getAiDashboardOverview Error]:', error);
    return { success: false, error: error.message };
  }
}

// 11. Edit Proposed Message & Approve Execution
export async function editAndApproveProposalAction(proposalId: string, customMessage: string, targetStageId?: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  const orgId = session.organizationId as string;
  const userId = session.userId as string;

  try {
    const [proposal] = await db
      .select()
      .from(aiActionProposals)
      .where(and(eq(aiActionProposals.id, proposalId), eq(aiActionProposals.organizationId, orgId)))
      .limit(1);

    if (!proposal) throw new Error('Proposal not found');

    const payload = JSON.parse(proposal.proposedPayload || '{}');
    const messageToSend = customMessage || payload.message;

    // Move stage if specified
    const stageId = targetStageId || payload.targetStageId;
    if (stageId) {
      await db.update(leads).set({ stageId, updatedAt: new Date() }).where(eq(leads.id, proposal.leadId));
      await db.insert(activities).values({
        organizationId: orgId,
        contactId: proposal.contactId,
        userId,
        type: 'LEAD_STAGE_CHANGED',
        description: `Lead stage updated via AI proposal approval`,
      });
    }

    // Send WhatsApp message if message body exists
    if (messageToSend && messageToSend.trim()) {
      const [contact] = await db.select().from(contacts).where(eq(contacts.id, proposal.contactId)).limit(1);
      const [activeSession] = await db.select().from(whatsappSessions).where(eq(whatsappSessions.organizationId, orgId)).limit(1);

      if (contact && activeSession) {
        await sendMessage(activeSession.sessionId, contact.whatsappId, messageToSend);
        await db.insert(activities).values({
          organizationId: orgId,
          contactId: proposal.contactId,
          userId,
          type: 'MESSAGE_SENT',
          description: `[AI Follow-Up Sent]: "${messageToSend.slice(0, 80)}..."`,
        });
      }
    }

    // Mark as APPROVED
    await db.update(aiActionProposals).set({
      status: 'APPROVED',
      approvedById: userId,
      proposedPayload: JSON.stringify({ ...payload, message: messageToSend, targetStageId: stageId }),
      executedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(aiActionProposals.id, proposalId));

    // Clear next follow-up deadline
    await db.update(leadIntelligence)
      .set({ nextFollowupAt: null, updatedAt: new Date() })
      .where(eq(leadIntelligence.leadId, proposal.leadId));

    revalidatePath('/dashboard/crm');
    revalidatePath('/dashboard/inbox');
    revalidatePath('/dashboard/ai');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// 12. Batch Approve All Pending Proposals
export async function batchApproveAllProposalsAction() {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  const orgId = session.organizationId as string;
  const userId = session.userId as string;

  try {
    const pending = await db
      .select()
      .from(aiActionProposals)
      .where(and(eq(aiActionProposals.organizationId, orgId), eq(aiActionProposals.status, 'PENDING_APPROVAL')));

    for (const p of pending) {
      await editAndApproveProposalAction(p.id, JSON.parse(p.proposedPayload || '{}').message);
    }

    revalidatePath('/dashboard/crm');
    revalidatePath('/dashboard/inbox');
    revalidatePath('/dashboard/ai');
    return { success: true, count: pending.length };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// 13. Update or Reschedule Follow-up Deadline & Message
export async function updateScheduledFollowupAction(leadId: string, data: { nextFollowupAt: string | null; nextSuggestedMessage?: string; nextFollowupReason?: string }) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  const orgId = session.organizationId as string;

  try {
    const dateVal = data.nextFollowupAt ? new Date(data.nextFollowupAt) : null;
    await db.update(leadIntelligence)
      .set({
        nextFollowupAt: dateVal,
        nextSuggestedMessage: data.nextSuggestedMessage,
        nextFollowupReason: data.nextFollowupReason,
        updatedAt: new Date(),
      })
      .where(and(eq(leadIntelligence.leadId, leadId), eq(leadIntelligence.organizationId, orgId)));

    revalidatePath('/dashboard/crm');
    revalidatePath('/dashboard/ai');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// 14. Cancel / Remove Scheduled Follow-up
export async function cancelScheduledFollowupAction(leadId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  const orgId = session.organizationId as string;

  try {
    await db.update(leadIntelligence)
      .set({ nextFollowupAt: null, updatedAt: new Date() })
      .where(and(eq(leadIntelligence.leadId, leadId), eq(leadIntelligence.organizationId, orgId)));

    // Dismiss pending proposal
    await db.update(aiActionProposals)
      .set({ status: 'REJECTED', updatedAt: new Date() })
      .where(and(eq(aiActionProposals.leadId, leadId), eq(aiActionProposals.status, 'PENDING_APPROVAL')));

    revalidatePath('/dashboard/crm');
    revalidatePath('/dashboard/ai');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// 15. Execute Follow-up Immediately Now
export async function executeFollowupNowAction(leadId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  const orgId = session.organizationId as string;
  const userId = session.userId as string;

  try {
    const [intel] = await db
      .select()
      .from(leadIntelligence)
      .where(and(eq(leadIntelligence.leadId, leadId), eq(leadIntelligence.organizationId, orgId)))
      .limit(1);

    if (!intel) throw new Error('Lead intelligence not found');

    const [contact] = await db.select().from(contacts).where(eq(contacts.id, intel.contactId)).limit(1);
    const [activeSession] = await db.select().from(whatsappSessions).where(eq(whatsappSessions.organizationId, orgId)).limit(1);

    let msg = intel.nextSuggestedMessage;
    if (!msg || !msg.trim()) {
      const fresh = await orchestrateLeadIntelligence(orgId, leadId);
      msg = fresh.strategy.suggestedMessage;
    }

    if (contact && activeSession && msg) {
      await sendMessage(activeSession.sessionId, contact.whatsappId, msg);
      await db.insert(activities).values({
        organizationId: orgId,
        contactId: intel.contactId,
        userId,
        type: 'MESSAGE_SENT',
        description: `[Manual AI Follow-Up Executed]: "${msg.slice(0, 80)}..."`,
      });
    }

    // Clear schedule
    await db.update(leadIntelligence)
      .set({ nextFollowupAt: null, lastAnalyzedAt: new Date(), updatedAt: new Date() })
      .where(eq(leadIntelligence.leadId, leadId));

    // Clear proposals
    await db.update(aiActionProposals)
      .set({ status: 'EXECUTED', executedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(aiActionProposals.leadId, leadId), eq(aiActionProposals.status, 'PENDING_APPROVAL')));

    revalidatePath('/dashboard/crm');
    revalidatePath('/dashboard/inbox');
    revalidatePath('/dashboard/ai');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// 16. Update Lead Intelligence Profile Manually
export async function updateLeadIntelligenceAction(leadId: string, data: {
  leadScore?: number;
  buyingIntent?: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNQUALIFIED';
  sentiment?: 'POSITIVE' | 'NEUTRAL' | 'CURIOUS' | 'FRUSTRATED' | 'COLD';
  conversationState?: any;
  summary?: string;
  need?: string;
  budget?: string;
}) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  const orgId = session.organizationId as string;

  try {
    await db.update(leadIntelligence)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(leadIntelligence.leadId, leadId), eq(leadIntelligence.organizationId, orgId)));

    revalidatePath('/dashboard/crm');
    revalidatePath('/dashboard/ai');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// 17. Delete Lead Intelligence Record
export async function deleteLeadIntelligenceAction(leadId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  const orgId = session.organizationId as string;

  try {
    await db.delete(leadIntelligence).where(and(eq(leadIntelligence.leadId, leadId), eq(leadIntelligence.organizationId, orgId)));
    await db.delete(aiActionProposals).where(and(eq(aiActionProposals.leadId, leadId), eq(aiActionProposals.organizationId, orgId)));

    revalidatePath('/dashboard/crm');
    revalidatePath('/dashboard/ai');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
