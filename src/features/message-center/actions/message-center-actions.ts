'use server';

import { db } from '@/shared/database';
import { 
  contacts, 
  leads, 
  queueJobs, 
  whatsappSessions, 
  activities,
  pipelines,
  pipelineStages,
  campaigns
} from '@/shared/database/schema';
import { getSession } from '@/features/auth/lib/auth-utils';
import { revalidatePath } from 'next/cache';
import { eq, and, asc, desc, sql, like } from 'drizzle-orm';
import { getSessions as engineGetSessions } from '@/features/whatsapp/lib/whatsapp-service';

function cleanPhoneNumber(phone: string): string {
  const digits = phone.toString().replace(/\D/g, '');
  if (!digits) return '';
  return `${digits}@c.us`;
}

function compileMessage(template: string, name: string, phone: string, customVars?: Record<string, string>) {
  let message = template;
  message = message.replace(/{{name}}/gi, name || 'Customer');
  message = message.replace(/{{firstName}}/gi, (name || 'Customer').split(' ')[0]);
  message = message.replace(/{{phone}}/gi, phone);
  
  if (customVars) {
    for (const [key, val] of Object.entries(customVars)) {
      const regex = new RegExp(`{{${key}}}`, 'gi');
      message = message.replace(regex, val || '');
    }
  }
  return message;
}

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Lazy seed default pipeline and stages for an organization
async function ensureDefaultPipeline(orgId: string) {
  const [existingPipeline] = await db.select().from(pipelines).where(eq(pipelines.organizationId, orgId)).limit(1);
  if (existingPipeline) {
    return existingPipeline.id;
  }

  return await db.transaction(async (tx) => {
    const [newPipeline] = await tx.insert(pipelines).values({
      organizationId: orgId,
      name: 'Sales Pipeline',
    }).returning();

    const stages = [
      { name: 'New', position: 1 },
      { name: 'Contacted', position: 2 },
      { name: 'Qualified', position: 3 },
      { name: 'Proposal', position: 4 },
      { name: 'Won', position: 5 },
      { name: 'Lost', position: 6 },
    ];

    for (const stage of stages) {
      await tx.insert(pipelineStages).values({
        pipelineId: newPipeline.id,
        name: stage.name,
        position: stage.position,
      });
    }

    return newPipeline.id;
  });
}

/**
 * Fetch all connected WhatsApp accounts/sessions
 */
export async function getConnectedSessionsAction() {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    const orgSessions = await db
      .select()
      .from(whatsappSessions)
      .where(eq(whatsappSessions.organizationId, orgId));

    const engineSessions = await engineGetSessions();

    const connectedSessions = orgSessions
      .map(s => {
        const es = engineSessions.find((e: any) => e.id === s.sessionId);
        return {
          ...s,
          state: es?.state || 'DISCONNECTED',
          ready: es?.ready || false,
        };
      })
      .filter(s => s.ready || s.state === 'CONNECTED');

    return { success: true, sessions: connectedSessions };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Queue bulk messages with staggered delays and optional CRM saving
 */
export async function queueBulkMessagesAction(
  broadcastName: string,
  recipients: { phone: string; name?: string; customVars?: Record<string, string> }[],
  messageTemplate: string,
  sessionId: string,
  saveToCRM: boolean,
  minDelay = 5,
  maxDelay = 15,
  mediaUrl: string | null = null
) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  if (recipients.length === 0) {
    return { success: false, error: 'Recipient list is empty.' };
  }

  try {
    let queuedCount = 0;
    
    await db.transaction(async (tx) => {
      // 1. Create a Campaign record specifically for this Message Center broadcast
      const [campaign] = await tx
        .insert(campaigns)
        .values({
          organizationId: orgId,
          name: `Message Center: ${broadcastName || 'Broadcast'}`,
          messageTemplate,
          sessionId,
          status: 'PENDING',
          minDelay,
          maxDelay,
          mediaUrl: mediaUrl || null,
        })
        .returning();

      let currentScheduledTime = new Date();

      for (let i = 0; i < recipients.length; i++) {
        const item = recipients[i];
        const rawPhone = item.phone.toString();
        const whatsappId = cleanPhoneNumber(rawPhone);
        if (!whatsappId) continue;

        const name = item.name || rawPhone;
        const displayPhone = whatsappId.split('@')[0];

        // 2. Optional CRM Save
        let contactId: string | null = null;
        if (saveToCRM) {
          const [existingContact] = await tx
            .select()
            .from(contacts)
            .where(
              and(
                eq(contacts.whatsappId, whatsappId),
                eq(contacts.organizationId, orgId)
              )
            )
            .limit(1);

          if (existingContact) {
            contactId = existingContact.id;
          } else {
            const [newContact] = await tx
              .insert(contacts)
              .values({
                organizationId: orgId,
                whatsappId,
                name: name,
                aiEnabled: true,
              })
              .returning();
            contactId = newContact.id;
          }
        }

        // 3. Stagger delay
        if (i > 0) {
          const delaySec = getRandomInt(minDelay, maxDelay);
          currentScheduledTime = new Date(currentScheduledTime.getTime() + delaySec * 1000);
        }

        // 4. Compile template
        const compiledMsg = compileMessage(messageTemplate, name, displayPhone, item.customVars);

        // 5. Insert Queue Job
        await tx.insert(queueJobs).values({
          organizationId: orgId,
          campaignId: campaign.id,
          sessionId,
          recipientWhatsappId: whatsappId,
          message: compiledMsg,
          mediaUrl: mediaUrl || null,
          status: 'PENDING',
          scheduledFor: new Date(currentScheduledTime.getTime()),
        });

        queuedCount++;
      }
    });

    revalidatePath('/dashboard/message-center');
    return { success: true, queuedCount };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Fetch all Message Center Broadcasts
 */
export async function getMessageCenterBroadcastsAction() {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    const list = await db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.organizationId, orgId),
          like(campaigns.name, 'Message Center:%')
        )
      )
      .orderBy(desc(campaigns.createdAt));

    // Fetch stats for each campaign
    const broadcasts = await Promise.all(
      list.map(async (c) => {
        const stats = await db
          .select({
            total: sql<number>`count(*)`,
            pending: sql<number>`sum(case when status = 'PENDING' then 1 else 0 end)`,
            processing: sql<number>`sum(case when status = 'PROCESSING' then 1 else 0 end)`,
            sent: sql<number>`sum(case when status = 'SENT' then 1 else 0 end)`,
            failed: sql<number>`sum(case when status = 'FAILED' then 1 else 0 end)`,
          })
          .from(queueJobs)
          .where(eq(queueJobs.campaignId, c.id));

        return {
          ...c,
          name: c.name.replace('Message Center: ', ''),
          stats: stats[0] || { total: 0, pending: 0, processing: 0, sent: 0, failed: 0 },
        };
      })
    );

    return { success: true, broadcasts };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Fetch detailed stats and queue logs for a single Message Center campaign
 */
export async function getBroadcastProgressAction(campaignId: string) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.id, campaignId),
          eq(campaigns.organizationId, orgId)
        )
      )
      .limit(1);

    if (!campaign) throw new Error('Broadcast not found.');

    const jobs = await db
      .select()
      .from(queueJobs)
      .where(eq(queueJobs.campaignId, campaignId))
      .orderBy(queueJobs.scheduledFor);

    const stats = await db
      .select({
        total: sql<number>`count(*)`,
        pending: sql<number>`sum(case when status = 'PENDING' then 1 else 0 end)`,
        processing: sql<number>`sum(case when status = 'PROCESSING' then 1 else 0 end)`,
        sent: sql<number>`sum(case when status = 'SENT' then 1 else 0 end)`,
        failed: sql<number>`sum(case when status = 'FAILED' then 1 else 0 end)`,
      })
      .from(queueJobs)
      .where(eq(queueJobs.campaignId, campaignId));

    return { 
      success: true, 
      campaign: {
        ...campaign,
        name: campaign.name.replace('Message Center: ', ''),
      }, 
      jobs, 
      stats: stats[0] || { total: 0, pending: 0, processing: 0, sent: 0, failed: 0 } 
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Pause or resume a Message Center bulk campaign
 */
export async function toggleBroadcastStatusAction(campaignId: string, pause: boolean) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    const status = pause ? 'PAUSED' : 'PENDING';
    
    await db
      .update(campaigns)
      .set({ status, updatedAt: new Date() })
      .where(
        and(
          eq(campaigns.id, campaignId),
          eq(campaigns.organizationId, orgId)
        )
      );

    revalidatePath('/dashboard/message-center');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Find or Create contact, and set their Lead Status in the CRM
 */
export async function convertOrUpdateLeadAction(
  phone: string,
  name: string,
  status: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'PROPOSAL' | 'WON' | 'LOST'
) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    const whatsappId = cleanPhoneNumber(phone);
    if (!whatsappId) throw new Error('Invalid phone number format.');

    const pipelineId = await ensureDefaultPipeline(orgId);
    const stagesList = await db
      .select()
      .from(pipelineStages)
      .where(eq(pipelineStages.pipelineId, pipelineId))
      .orderBy(asc(pipelineStages.position));
    
    // Match stage based on status
    let stageId = stagesList[0]?.id; // Default to first stage ('New')
    if (status === 'QUALIFIED') {
      stageId = stagesList.find(s => s.name.toLowerCase() === 'qualified')?.id || stageId;
    } else if (status === 'CONTACTED') {
      stageId = stagesList.find(s => s.name.toLowerCase() === 'contacted')?.id || stageId;
    } else if (status === 'PROPOSAL') {
      stageId = stagesList.find(s => s.name.toLowerCase() === 'proposal')?.id || stageId;
    } else if (status === 'WON') {
      stageId = stagesList.find(s => s.name.toLowerCase() === 'won')?.id || stageId;
    } else if (status === 'LOST') {
      stageId = stagesList.find(s => s.name.toLowerCase() === 'lost')?.id || stageId;
    }

    let contactId = '';

    await db.transaction(async (tx) => {
      // 1. Resolve Contact
      let [contact] = await tx
        .select()
        .from(contacts)
        .where(
          and(
            eq(contacts.whatsappId, whatsappId),
            eq(contacts.organizationId, orgId)
          )
        )
        .limit(1);

      if (!contact) {
        [contact] = await tx
          .insert(contacts)
          .values({
            organizationId: orgId,
            whatsappId,
            name: name || phone,
            aiEnabled: true,
          })
          .returning();
      }
      contactId = contact.id;

      // 2. Resolve Lead
      const [lead] = await tx
        .select()
        .from(leads)
        .where(
          and(
            eq(leads.contactId, contactId),
            eq(leads.organizationId, orgId)
          )
        )
        .limit(1);

      if (lead) {
        // Update status and stage
        await tx
          .update(leads)
          .set({ status, stageId, updatedAt: new Date() })
          .where(eq(leads.id, lead.id));
      } else {
        // Create new Lead
        await tx
          .insert(leads)
          .values({
            organizationId: orgId,
            contactId,
            status,
            stageId,
          });
      }

      // 3. Log Activity
      await tx.insert(activities).values({
        organizationId: orgId,
        contactId,
        type: 'LEAD_STAGE_CHANGED',
        description: `Lead status updated to ${status} via Message Center.`,
        userId: userSession.userId as string,
      });
    });

    revalidatePath('/dashboard/crm');
    return { success: true, contactId };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
