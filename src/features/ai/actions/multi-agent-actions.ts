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
import { eq, and, desc, inArray } from 'drizzle-orm';
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
