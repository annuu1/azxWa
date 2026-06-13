'use server';

import { db } from '@/shared/database';
import { campaigns, queueJobs, contacts, contactTags } from '@/shared/database/schema';
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

export async function createCampaign(
  name: string,
  messageTemplate: string,
  targetTagId: string | null,
  sessionId: string,
  scheduledAt: string | null
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

    // 3. Queue up message jobs
    await db.transaction(async (tx) => {
      for (const contact of targetContacts) {
        const compiledMsg = compileMessage(messageTemplate, contact);

        await tx.insert(queueJobs).values({
          organizationId: orgId,
          campaignId: newCampaign.id,
          sessionId,
          recipientWhatsappId: contact.whatsappId,
          message: compiledMsg,
          status: 'PENDING',
          scheduledFor: parsedScheduledAt,
        });
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
