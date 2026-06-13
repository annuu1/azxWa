'use server';

import { db } from '@/shared/database';
import { campaigns, queueJobs, contacts, contactTags, templates } from '@/shared/database/schema';
import { getSession } from '@/features/auth/lib/auth-utils';
import { revalidatePath } from 'next/cache';
import { eq, and, sql, desc } from 'drizzle-orm';

function compileMessage(template: string, contact: any) {
  let message = template;
  message = message.replace(/{{name}}/gi, contact.name || contact.pushName || 'Customer');
  message = message.replace(/{{firstName}}/gi, (contact.name || contact.pushName || 'Customer').split(' ')[0]);
  message = message.replace(/{{pushName}}/gi, contact.pushName || 'Customer');
  message = message.replace(/{{phone}}/gi, contact.whatsappId.split('@')[0]);
  return message;
}

export async function getCampaignsList() {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    const list = await db.select().from(campaigns).where(eq(campaigns.organizationId, orgId)).orderBy(desc(campaigns.createdAt));
    
    // Fetch statistics for each campaign from the queueJobs table
    const campaignsWithStats = await Promise.all(
      list.map(async (c) => {
        const stats = await db.select({
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
          stats: stats[0] || { total: 0, pending: 0, processing: 0, sent: 0, failed: 0 },
        };
      })
    );

    return { success: true, campaigns: campaignsWithStats };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function createCampaign(
  name: string,
  messageTemplate: string,
  targetTagId: string | null,
  sessionId: string,
  scheduledAt: string | null,
  minDelay = 5,
  maxDelay = 20,
  minBatchDelay = 30,
  maxBatchDelay = 120,
  minBatchSize = 35,
  maxBatchSize = 50,
  mediaUrl: string | null = null
) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    const parsedScheduledAt = scheduledAt ? new Date(scheduledAt) : new Date();

    // 1. Insert Campaign
    const [newCampaign] = await db.insert(campaigns).values({
      organizationId: orgId,
      name,
      messageTemplate,
      targetTagId: targetTagId || null,
      sessionId,
      scheduledAt: scheduledAt ? parsedScheduledAt : null,
      status: 'PENDING',
      minDelay,
      maxDelay,
      minBatchDelay,
      maxBatchDelay,
      minBatchSize,
      maxBatchSize,
      mediaUrl: mediaUrl || null,
    }).returning();

    // 2. Fetch target contacts
    let targetContacts: any[] = [];
    if (targetTagId) {
      targetContacts = await db.select({
        id: contacts.id,
        name: contacts.name,
        pushName: contacts.pushName,
        whatsappId: contacts.whatsappId,
      })
      .from(contactTags)
      .innerJoin(contacts, eq(contactTags.contactId, contacts.id))
      .where(
        and(
          eq(contactTags.tagId, targetTagId),
          eq(contacts.organizationId, orgId)
        )
      );
    } else {
      // Send to all contacts in the organization
      targetContacts = await db.select().from(contacts).where(eq(contacts.organizationId, orgId));
    }

    if (targetContacts.length === 0) {
      // Mark campaign completed immediately since there's no audience
      await db.update(campaigns)
        .set({ status: 'COMPLETED' })
        .where(eq(campaigns.id, newCampaign.id));
      
      revalidatePath('/dashboard/campaigns');
      return { success: true, message: 'Campaign created but target audience was empty.' };
    }

    // 3. Queue up message jobs with batch and message delays
    await db.transaction(async (tx) => {
      let currentScheduledTime = new Date(parsedScheduledAt.getTime());
      let currentBatchSize = getRandomInt(minBatchSize, maxBatchSize);
      let currentBatchCount = 0;

      for (const contact of targetContacts) {
        if (currentBatchCount >= currentBatchSize) {
          // Add batch delay
          const batchDelaySec = getRandomInt(minBatchDelay, maxBatchDelay);
          currentScheduledTime = new Date(currentScheduledTime.getTime() + batchDelaySec * 1000);
          
          // Reset batch parameters
          currentBatchSize = getRandomInt(minBatchSize, maxBatchSize);
          currentBatchCount = 0;
        } else if (currentBatchCount > 0) {
          // Add normal message delay
          const msgDelaySec = getRandomInt(minDelay, maxDelay);
          currentScheduledTime = new Date(currentScheduledTime.getTime() + msgDelaySec * 1000);
        }

        const compiledMsg = compileMessage(messageTemplate, contact);

        await tx.insert(queueJobs).values({
          organizationId: orgId,
          campaignId: newCampaign.id,
          sessionId,
          recipientWhatsappId: contact.whatsappId,
          message: compiledMsg,
          status: 'PENDING',
          scheduledFor: currentScheduledTime,
          mediaUrl: mediaUrl || null,
        });

        currentBatchCount++;
      }
    });

    revalidatePath('/dashboard/campaigns');
    return { success: true, campaign: newCampaign };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getCampaignDetails(campaignId: string) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    const [c] = await db.select().from(campaigns).where(
      and(
        eq(campaigns.id, campaignId),
        eq(campaigns.organizationId, orgId)
      )
    ).limit(1);

    if (!c) throw new Error('Campaign not found');

    const jobs = await db.select().from(queueJobs).where(eq(queueJobs.campaignId, campaignId));

    return { success: true, campaign: c, jobs };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function pauseCampaign(campaignId: string) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    await db.update(campaigns)
      .set({ status: 'PAUSED', updatedAt: new Date() })
      .where(
        and(
          eq(campaigns.id, campaignId),
          eq(campaigns.organizationId, orgId)
        )
      );

    revalidatePath('/dashboard/campaigns');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function resumeCampaign(campaignId: string) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    await db.update(campaigns)
      .set({ status: 'PENDING', updatedAt: new Date() })
      .where(
        and(
          eq(campaigns.id, campaignId),
          eq(campaigns.organizationId, orgId)
        )
      );

    revalidatePath('/dashboard/campaigns');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function cancelCampaign(campaignId: string) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    await db.update(campaigns)
      .set({ status: 'CANCELLED', updatedAt: new Date() })
      .where(
        and(
          eq(campaigns.id, campaignId),
          eq(campaigns.organizationId, orgId)
        )
      );

    await db.update(queueJobs)
      .set({ status: 'FAILED', error: 'Campaign cancelled by user', updatedAt: new Date() })
      .where(
        and(
          eq(queueJobs.campaignId, campaignId),
          eq(queueJobs.status, 'PENDING')
        )
      );

    revalidatePath('/dashboard/campaigns');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function editCampaign(
  campaignId: string,
  name: string,
  messageTemplate: string,
  scheduledAt: string | null,
  minDelay = 5,
  maxDelay = 20,
  minBatchDelay = 30,
  maxBatchDelay = 120,
  minBatchSize = 35,
  maxBatchSize = 50,
  mediaUrl: string | null = null
) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    const [c] = await db.select().from(campaigns).where(
      and(
        eq(campaigns.id, campaignId),
        eq(campaigns.organizationId, orgId)
      )
    ).limit(1);

    if (!c) throw new Error('Campaign not found');

    const parsedScheduledAt = scheduledAt ? new Date(scheduledAt) : new Date();

    // 1. Update Campaign
    await db.update(campaigns)
      .set({
        name,
        messageTemplate,
        scheduledAt: scheduledAt ? parsedScheduledAt : null,
        minDelay,
        maxDelay,
        minBatchDelay,
        maxBatchDelay,
        minBatchSize,
        maxBatchSize,
        mediaUrl: mediaUrl || null,
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, campaignId));

    // 2. Fetch all recipient IDs that have already been sent a message in this campaign
    const sentJobs = await db.select({
      recipientWhatsappId: queueJobs.recipientWhatsappId
    })
    .from(queueJobs)
    .where(
      and(
        eq(queueJobs.campaignId, campaignId),
        eq(queueJobs.status, 'SENT')
      )
    );
    const sentRecipientIds = new Set(sentJobs.map(j => j.recipientWhatsappId));

    // 3. Delete existing pending/processing queue jobs for this campaign
    await db.delete(queueJobs).where(
      and(
        eq(queueJobs.campaignId, campaignId),
        sql`${queueJobs.status} IN ('PENDING', 'PROCESSING')`
      )
    );

    // 4. Regenerate queue jobs for remaining contacts
    let targetContacts: any[] = [];
    if (c.targetTagId) {
      targetContacts = await db.select({
        id: contacts.id,
        name: contacts.name,
        pushName: contacts.pushName,
        whatsappId: contacts.whatsappId,
      })
      .from(contactTags)
      .innerJoin(contacts, eq(contactTags.contactId, contacts.id))
      .where(
        and(
          eq(contactTags.tagId, c.targetTagId),
          eq(contacts.organizationId, orgId)
        )
      );
    } else {
      targetContacts = await db.select().from(contacts).where(eq(contacts.organizationId, orgId));
    }

    if (targetContacts.length > 0) {
      await db.transaction(async (tx) => {
        let currentScheduledTime = new Date(parsedScheduledAt.getTime());
        let currentBatchSize = getRandomInt(minBatchSize, maxBatchSize);
        let currentBatchCount = 0;

        for (const contact of targetContacts) {
          if (sentRecipientIds.has(contact.whatsappId)) {
            continue; // Skip already sent contacts to prevent duplicates
          }

          if (currentBatchCount >= currentBatchSize) {
            // Add batch delay
            const batchDelaySec = getRandomInt(minBatchDelay, maxBatchDelay);
            currentScheduledTime = new Date(currentScheduledTime.getTime() + batchDelaySec * 1000);
            
            // Reset batch parameters
            currentBatchSize = getRandomInt(minBatchSize, maxBatchSize);
            currentBatchCount = 0;
          } else if (currentBatchCount > 0) {
            // Add normal message delay
            const msgDelaySec = getRandomInt(minDelay, maxDelay);
            currentScheduledTime = new Date(currentScheduledTime.getTime() + msgDelaySec * 1000);
          }

          const compiledMsg = compileMessage(messageTemplate, contact);

          await tx.insert(queueJobs).values({
            organizationId: orgId,
            campaignId: campaignId,
            sessionId: c.sessionId,
            recipientWhatsappId: contact.whatsappId,
            message: compiledMsg,
            status: 'PENDING',
            scheduledFor: currentScheduledTime,
            mediaUrl: mediaUrl || null,
          });

          currentBatchCount++;
        }
      });
    }

    revalidatePath('/dashboard/campaigns');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteCampaign(campaignId: string) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    const [c] = await db.select().from(campaigns).where(
      and(
        eq(campaigns.id, campaignId),
        eq(campaigns.organizationId, orgId)
      )
    ).limit(1);

    if (!c) throw new Error('Campaign not found');

    await db.transaction(async (tx) => {
      await tx.delete(queueJobs).where(eq(queueJobs.campaignId, campaignId));
      await tx.delete(campaigns).where(eq(campaigns.id, campaignId));
    });

    revalidatePath('/dashboard/campaigns');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function startCampaignImmediately(campaignId: string) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    const [c] = await db.select().from(campaigns).where(
      and(
        eq(campaigns.id, campaignId),
        eq(campaigns.organizationId, orgId)
      )
    ).limit(1);

    if (!c) throw new Error('Campaign not found');

    const now = new Date();
    await db.update(campaigns)
      .set({ status: 'PENDING', scheduledAt: now, updatedAt: now })
      .where(eq(campaigns.id, campaignId));

    // Fetch all PENDING queue jobs for this campaign
    const pendingJobs = await db.select().from(queueJobs).where(
      and(
        eq(queueJobs.campaignId, campaignId),
        eq(queueJobs.status, 'PENDING')
      )
    );

    if (pendingJobs.length > 0) {
      await db.transaction(async (tx) => {
        let currentScheduledTime = new Date(now.getTime());
        let currentBatchSize = getRandomInt(c.minBatchSize, c.maxBatchSize);
        let currentBatchCount = 0;

        for (const job of pendingJobs) {
          if (currentBatchCount >= currentBatchSize) {
            // Add batch delay
            const batchDelaySec = getRandomInt(c.minBatchDelay, c.maxBatchDelay);
            currentScheduledTime = new Date(currentScheduledTime.getTime() + batchDelaySec * 1000);
            
            // Reset batch parameters
            currentBatchSize = getRandomInt(c.minBatchSize, c.maxBatchSize);
            currentBatchCount = 0;
          } else if (currentBatchCount > 0) {
            // Add normal message delay
            const msgDelaySec = getRandomInt(c.minDelay, c.maxDelay);
            currentScheduledTime = new Date(currentScheduledTime.getTime() + msgDelaySec * 1000);
          }

          await tx.update(queueJobs)
            .set({ scheduledFor: currentScheduledTime, updatedAt: new Date() })
            .where(eq(queueJobs.id, job.id));

          currentBatchCount++;
        }
      });
    }

    revalidatePath('/dashboard/campaigns');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function restartCampaign(campaignId: string) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    const [c] = await db.select().from(campaigns).where(
      and(
        eq(campaigns.id, campaignId),
        eq(campaigns.organizationId, orgId)
      )
    ).limit(1);

    if (!c) throw new Error('Campaign not found');

    const now = new Date();
    await db.update(campaigns)
      .set({ status: 'PENDING', scheduledAt: now, updatedAt: now })
      .where(eq(campaigns.id, campaignId));

    // Fetch all queue jobs for this campaign
    const jobs = await db.select().from(queueJobs).where(
      eq(queueJobs.campaignId, campaignId)
    );

    if (jobs.length > 0) {
      await db.transaction(async (tx) => {
        let currentScheduledTime = new Date(now.getTime());
        let currentBatchSize = getRandomInt(c.minBatchSize, c.maxBatchSize);
        let currentBatchCount = 0;

        for (const job of jobs) {
          if (currentBatchCount >= currentBatchSize) {
            // Add batch delay
            const batchDelaySec = getRandomInt(c.minBatchDelay, c.maxBatchDelay);
            currentScheduledTime = new Date(currentScheduledTime.getTime() + batchDelaySec * 1000);
            
            // Reset batch parameters
            currentBatchSize = getRandomInt(c.minBatchSize, c.maxBatchSize);
            currentBatchCount = 0;
          } else if (currentBatchCount > 0) {
            // Add normal message delay
            const msgDelaySec = getRandomInt(c.minDelay, c.maxDelay);
            currentScheduledTime = new Date(currentScheduledTime.getTime() + msgDelaySec * 1000);
          }

          await tx.update(queueJobs)
            .set({
              status: 'PENDING',
              attempts: 0,
              error: null,
              scheduledFor: currentScheduledTime,
              updatedAt: new Date()
            })
            .where(eq(queueJobs.id, job.id));

          currentBatchCount++;
        }
      });
    }

    revalidatePath('/dashboard/campaigns');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getTemplatesList() {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    const list = await db.select().from(templates).where(eq(templates.organizationId, orgId)).orderBy(desc(templates.createdAt));
    return { success: true, templates: list };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createTemplate(name: string, content: string) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    const [newTemplate] = await db.insert(templates).values({
      organizationId: orgId,
      name,
      content,
    }).returning();

    revalidatePath('/dashboard/campaigns');
    return { success: true, template: newTemplate };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteTemplate(templateId: string) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    await db.delete(templates).where(
      and(
        eq(templates.id, templateId),
        eq(templates.organizationId, orgId)
      )
    );

    revalidatePath('/dashboard/campaigns');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

