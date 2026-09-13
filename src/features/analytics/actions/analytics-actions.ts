'use server';

import { db } from '@/shared/database';
import { 
  leads, 
  contacts, 
  activities, 
  leadIntelligence, 
  aiActionProposals, 
  whatsappSessions, 
  campaigns,
  pipelineStages,
  pipelines,
  organizations,
  aiSettings
} from '@/shared/database/schema';
import { getSession } from '@/features/auth/lib/auth-utils';
import { eq, and, sql, desc, gte, asc } from 'drizzle-orm';

export interface DashboardMetrics {
  organizationName: string;
  totalContacts: number;
  totalLeads: number;
  stagesBreakdown: Array<{ id: string; name: string; position: number; count: number }>;
  aiMetrics: {
    totalProfiled: number;
    hotLeadsCount: number;
    avgScore: number;
    pendingProposalsCount: number;
    executedProposalsCount: number;
    intents: { high: number; medium: number; low: number; unqualified: number };
    aiMode: 'AUTONOMOUS' | 'APPROVAL_REQUIRED';
    aiEnabled: boolean;
  };
  whatsappMetrics: {
    totalSessions: number;
    connectedSessions: number;
    sentLast24h: number;
    receivedLast24h: number;
    sessions: Array<{ id: string; sessionId: string; status: string; phoneNumber?: string | null }>;
  };
  campaignMetrics: {
    total: number;
    active: number;
    completed: number;
  };
  recentActivities: Array<{
    id: string;
    type: string;
    description: string;
    createdAt: Date;
    contactName?: string | null;
    whatsappId?: string | null;
  }>;
  urgentEscalations: Array<{
    id: string;
    description: string;
    createdAt: Date;
    contactName?: string | null;
    whatsappId?: string | null;
    contactId: string;
  }>;
}

export async function getDashboardMetrics(): Promise<DashboardMetrics | null> {
  const session = await getSession();
  if (!session) return null;

  const orgId = session.organizationId as string;

  // 1. Fetch organization info
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);

  // 2. Fetch AI settings
  const [settings] = await db.select().from(aiSettings).where(eq(aiSettings.organizationId, orgId)).limit(1);

  // 3. Total Contacts
  const [contactsCountRes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(contacts)
    .where(eq(contacts.organizationId, orgId));
  const totalContacts = Number(contactsCountRes?.count || 0);

  // 4. Total Leads
  const [leadsCountRes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(eq(leads.organizationId, orgId));
  const totalLeads = Number(leadsCountRes?.count || 0);

  // 5. Stages Breakdown
  const stagesList = await db
    .select({
      id: pipelineStages.id,
      name: pipelineStages.name,
      position: pipelineStages.position,
    })
    .from(pipelineStages)
    .innerJoin(pipelines, eq(pipelineStages.pipelineId, pipelines.id))
    .where(eq(pipelines.organizationId, orgId))
    .orderBy(asc(pipelineStages.position));

  const stagesWithCounts: Array<{ id: string; name: string; position: number; count: number }> = [];
  for (const stage of stagesList) {
    const [countRes] = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(and(eq(leads.stageId, stage.id), eq(leads.organizationId, orgId)));
    stagesWithCounts.push({
      id: stage.id,
      name: stage.name,
      position: stage.position,
      count: Number(countRes?.count || 0),
    });
  }

  // 6. Lead Intelligence Metrics
  const intelRecords = await db
    .select({
      leadScore: leadIntelligence.leadScore,
      buyingIntent: leadIntelligence.buyingIntent,
      sentiment: leadIntelligence.sentiment,
    })
    .from(leadIntelligence)
    .where(eq(leadIntelligence.organizationId, orgId));

  const totalProfiled = intelRecords.length;
  let hotLeadsCount = 0;
  let totalScore = 0;
  const intents = { high: 0, medium: 0, low: 0, unqualified: 0 };

  for (const item of intelRecords) {
    totalScore += item.leadScore || 0;
    if ((item.leadScore || 0) >= 75 || item.buyingIntent === 'HIGH') {
      hotLeadsCount++;
    }
    if (item.buyingIntent === 'HIGH') intents.high++;
    else if (item.buyingIntent === 'MEDIUM') intents.medium++;
    else if (item.buyingIntent === 'LOW') intents.low++;
    else intents.unqualified++;
  }

  const avgScore = totalProfiled > 0 ? Math.round(totalScore / totalProfiled) : 0;

  // 7. Action Proposals Counts
  const [pendingProposalsRes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(aiActionProposals)
    .where(
      and(
        eq(aiActionProposals.organizationId, orgId),
        eq(aiActionProposals.status, 'PENDING_APPROVAL')
      )
    );

  const [executedProposalsRes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(aiActionProposals)
    .where(
      and(
        eq(aiActionProposals.organizationId, orgId),
        eq(aiActionProposals.status, 'AUTO_EXECUTED')
      )
    );

  // 8. WhatsApp Sessions & Volume
  const rawSessions = await db
    .select({
      id: whatsappSessions.id,
      sessionId: whatsappSessions.sessionId,
      status: whatsappSessions.status,
    })
    .from(whatsappSessions)
    .where(eq(whatsappSessions.organizationId, orgId));

  const sessions = rawSessions.map((s) => ({
    id: s.id,
    sessionId: s.sessionId,
    status: s.status || 'DISCONNECTED',
    phoneNumber: null as string | null,
  }));

  const connectedSessions = sessions.filter(s => s.status === 'CONNECTED' || s.status === 'READY').length;

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [sentRes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(activities)
    .where(
      and(
        eq(activities.organizationId, orgId),
        eq(activities.type, 'MESSAGE_SENT'),
        gte(activities.createdAt, yesterday)
      )
    );

  const [receivedRes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(activities)
    .where(
      and(
        eq(activities.organizationId, orgId),
        eq(activities.type, 'MESSAGE_RECEIVED'),
        gte(activities.createdAt, yesterday)
      )
    );

  // 9. Campaigns Count
  const campaignRecords = await db
    .select({ status: campaigns.status })
    .from(campaigns)
    .where(eq(campaigns.organizationId, orgId));

  const totalCampaigns = campaignRecords.length;
  const activeCampaigns = campaignRecords.filter(c => c.status === 'PROCESSING' || c.status === 'PENDING').length;
  const completedCampaigns = campaignRecords.filter(c => c.status === 'COMPLETED').length;

  // 10. Recent Activities
  const recentActivitiesRaw = await db
    .select({
      id: activities.id,
      type: activities.type,
      description: activities.description,
      createdAt: activities.createdAt,
      contactName: contacts.name,
      contactPushName: contacts.pushName,
      whatsappId: contacts.whatsappId,
    })
    .from(activities)
    .leftJoin(contacts, eq(activities.contactId, contacts.id))
    .where(eq(activities.organizationId, orgId))
    .orderBy(desc(activities.createdAt))
    .limit(8);

  const recentActivities = recentActivitiesRaw.map(a => ({
    id: a.id,
    type: a.type,
    description: a.description,
    createdAt: a.createdAt || new Date(),
    contactName: a.contactName || a.contactPushName || 'WhatsApp Contact',
    whatsappId: a.whatsappId,
  }));

  // 11. Urgent Human Escalations (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const urgentEscalationsRaw = await db
    .select({
      id: activities.id,
      description: activities.description,
      createdAt: activities.createdAt,
      contactId: activities.contactId,
      contactName: contacts.name,
      contactPushName: contacts.pushName,
      whatsappId: contacts.whatsappId,
    })
    .from(activities)
    .leftJoin(contacts, eq(activities.contactId, contacts.id))
    .where(
      and(
        eq(activities.organizationId, orgId),
        eq(activities.type, 'ESCALATE_HUMAN'),
        gte(activities.createdAt, sevenDaysAgo)
      )
    )
    .orderBy(desc(activities.createdAt))
    .limit(5);

  const urgentEscalations = urgentEscalationsRaw.map(e => ({
    id: e.id,
    description: e.description,
    createdAt: e.createdAt || new Date(),
    contactId: e.contactId || '',
    contactName: e.contactName || e.contactPushName || 'Urgent Contact',
    whatsappId: e.whatsappId,
  }));

  return {
    organizationName: org?.name || 'AutoZoneX Connect',
    totalContacts,
    totalLeads,
    stagesBreakdown: stagesWithCounts,
    aiMetrics: {
      totalProfiled,
      hotLeadsCount,
      avgScore,
      pendingProposalsCount: Number(pendingProposalsRes?.count || 0),
      executedProposalsCount: Number(executedProposalsRes?.count || 0),
      intents,
      aiMode: (settings?.aiMode as any) || 'APPROVAL_REQUIRED',
      aiEnabled: Boolean(settings?.enabled),
    },
    whatsappMetrics: {
      totalSessions: sessions.length,
      connectedSessions,
      sentLast24h: Number(sentRes?.count || 0),
      receivedLast24h: Number(receivedRes?.count || 0),
      sessions,
    },
    campaignMetrics: {
      total: totalCampaigns,
      active: activeCampaigns,
      completed: completedCampaigns,
    },
    recentActivities,
    urgentEscalations,
  };
}
