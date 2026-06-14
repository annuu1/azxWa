'use server';

import { db } from '@/shared/database';
import { 
  contacts, 
  leads, 
  queueJobs, 
  whatsappSessions, 
  activities,
  pipelines,
  pipelineStages
} from '@/shared/database/schema';
import { getSession } from '@/features/auth/lib/auth-utils';
import { revalidatePath } from 'next/cache';
import { eq, and, asc } from 'drizzle-orm';

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
    const sessions = await db
      .select()
      .from(whatsappSessions)
      .where(
        and(
          eq(whatsappSessions.organizationId, orgId),
          eq(whatsappSessions.status, 'CONNECTED')
        )
      );
    return { success: true, sessions };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Queue bulk messages with staggered delays and optional CRM saving
 */
export async function queueBulkMessagesAction(
  recipients: { phone: string; name?: string; customVars?: Record<string, string> }[],
  messageTemplate: string,
  sessionId: string,
  saveToCRM: boolean,
  minDelay = 5,
  maxDelay = 15
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
      let currentScheduledTime = new Date();

      for (let i = 0; i < recipients.length; i++) {
        const item = recipients[i];
        const rawPhone = item.phone.toString();
        const whatsappId = cleanPhoneNumber(rawPhone);
        if (!whatsappId) continue;

        const name = item.name || rawPhone;
        const displayPhone = whatsappId.split('@')[0];

        // 1. Optional CRM Save
        let contactId: string | null = null;
        if (saveToCRM) {
          // Check if contact already exists
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

        // 2. Stagger delay
        if (i > 0) {
          const delaySec = getRandomInt(minDelay, maxDelay);
          currentScheduledTime = new Date(currentScheduledTime.getTime() + delaySec * 1000);
        }

        // 3. Compile template
        const compiledMsg = compileMessage(messageTemplate, name, displayPhone, item.customVars);

        // 4. Insert Queue Job
        await tx.insert(queueJobs).values({
          organizationId: orgId,
          sessionId,
          recipientWhatsappId: whatsappId,
          message: compiledMsg,
          status: 'PENDING',
          scheduledFor: new Date(currentScheduledTime.getTime()),
        });

        queuedCount++;
      }
    });

    revalidatePath('/dashboard/campaigns');
    return { success: true, queuedCount };
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
