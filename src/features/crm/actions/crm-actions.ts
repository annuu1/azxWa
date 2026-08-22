'use server';

import { db } from '@/shared/database';
import { 
  contacts, 
  leads, 
  pipelines, 
  pipelineStages, 
  users, 
  tags, 
  contactTags, 
  notes, 
  activities 
} from '@/shared/database/schema';
import { getSession } from '@/features/auth/lib/auth-utils';
import { revalidatePath } from 'next/cache';
import { eq, and, asc } from 'drizzle-orm';

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

export async function getOrgContacts() {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    const allContacts = await db.select().from(contacts).where(eq(contacts.organizationId, orgId));
    
    // For each contact, fetch their tag associations
    const contactsWithTags = await Promise.all(
      allContacts.map(async (c) => {
        const contactLead = await db.select().from(leads).where(eq(leads.contactId, c.id)).limit(1);
        const contactAppliedTags = await db.select({
          id: tags.id,
          name: tags.name,
          color: tags.color,
        })
        .from(contactTags)
        .innerJoin(tags, eq(contactTags.tagId, tags.id))
        .where(eq(contactTags.contactId, c.id));

        return {
          ...c,
          isLead: contactLead.length > 0,
          leadStatus: contactLead[0]?.status || 'NONE',
          tags: contactAppliedTags,
        };
      })
    );

    return { success: true, contacts: contactsWithTags };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function convertContactToLead(contactId: string) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    const pipelineId = await ensureDefaultPipeline(orgId);
    const stagesList = await db.select().from(pipelineStages).where(eq(pipelineStages.pipelineId, pipelineId)).orderBy(asc(pipelineStages.position));
    const firstStageId = stagesList[0]?.id;

    if (!firstStageId) {
      throw new Error('Default pipeline stages not configured');
    }

    const [existingLead] = await db.select().from(leads).where(
      and(
        eq(leads.contactId, contactId),
        eq(leads.organizationId, orgId)
      )
    ).limit(1);

    if (existingLead) {
      return { success: true, lead: existingLead };
    }

    const [newLead] = await db.insert(leads).values({
      organizationId: orgId,
      contactId,
      stageId: firstStageId,
      status: 'NEW',
    }).returning();

    await db.insert(activities).values({
      organizationId: orgId,
      contactId,
      type: 'CONVERTED',
      description: 'Contact qualified and converted to lead.',
      userId: userSession.userId as string,
    });

    revalidatePath('/dashboard/crm');
    return { success: true, lead: newLead };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getPipelineData() {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    const pipelineId = await ensureDefaultPipeline(orgId);
    const stages = await db.select().from(pipelineStages).where(eq(pipelineStages.pipelineId, pipelineId)).orderBy(asc(pipelineStages.position));
    
    const allLeads = await db.select({
      id: leads.id,
      status: leads.status,
      stageId: leads.stageId,
      assignedUserId: leads.assignedUserId,
      createdAt: leads.createdAt,
      contact: {
        id: contacts.id,
        name: contacts.name,
        pushName: contacts.pushName,
        whatsappId: contacts.whatsappId,
      },
      assignedUser: {
        id: users.id,
        email: users.email,
      }
    })
    .from(leads)
    .innerJoin(contacts, eq(leads.contactId, contacts.id))
    .leftJoin(users, eq(leads.assignedUserId, users.id))
    .where(eq(leads.organizationId, orgId));

    // For each lead, fetch tags
    const leadsWithTags = await Promise.all(
      allLeads.map(async (l) => {
        const leadTags = await db.select({
          id: tags.id,
          name: tags.name,
          color: tags.color,
        })
        .from(contactTags)
        .innerJoin(tags, eq(contactTags.tagId, tags.id))
        .where(eq(contactTags.contactId, l.contact.id));

        return {
          ...l,
          tags: leadTags,
        };
      })
    );

    return { success: true, stages, leads: leadsWithTags };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateLeadStage(leadId: string, stageId: string) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    const [lead] = await db.select().from(leads).where(
      and(
        eq(leads.id, leadId),
        eq(leads.organizationId, orgId)
      )
    ).limit(1);

    if (!lead) throw new Error('Lead not found');

    const [stage] = await db.select().from(pipelineStages).where(eq(pipelineStages.id, stageId)).limit(1);
    if (!stage) throw new Error('Stage not found');

    await db.update(leads)
      .set({ stageId, updatedAt: new Date() })
      .where(eq(leads.id, leadId));

    await db.insert(activities).values({
      organizationId: orgId,
      contactId: lead.contactId,
      type: 'LEAD_STAGE_CHANGED',
      description: `Lead moved to stage: ${stage.name}`,
      userId: userSession.userId as string,
    });

    revalidatePath('/dashboard/crm/pipeline');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function assignLeadAgent(leadId: string, agentId: string | null) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    const [lead] = await db.select().from(leads).where(
      and(
        eq(leads.id, leadId),
        eq(leads.organizationId, orgId)
      )
    ).limit(1);

    if (!lead) throw new Error('Lead not found');

    let description = 'Lead unassigned';
    if (agentId) {
      const [agent] = await db.select().from(users).where(
        and(
          eq(users.id, agentId),
          eq(users.organizationId, orgId)
        )
      ).limit(1);
      if (!agent) throw new Error('Agent not found');
      description = `Lead assigned to agent: ${agent.email}`;
    }

    await db.update(leads)
      .set({ assignedUserId: agentId, updatedAt: new Date() })
      .where(eq(leads.id, leadId));

    await db.insert(activities).values({
      organizationId: orgId,
      contactId: lead.contactId,
      type: 'LEAD_ASSIGNED',
      description,
      userId: userSession.userId as string,
    });

    revalidatePath('/dashboard/crm');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getContactDetails(contactId: string) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    const [contact] = await db.select().from(contacts).where(
      and(
        eq(contacts.id, contactId),
        eq(contacts.organizationId, orgId)
      )
    ).limit(1);

    if (!contact) throw new Error('Contact not found');

    const [lead] = await db.select().from(leads).where(
      and(
        eq(leads.contactId, contactId),
        eq(leads.organizationId, orgId)
      )
    ).limit(1);

    const contactNotes = await db.select({
      id: notes.id,
      content: notes.content,
      createdAt: notes.createdAt,
      user: {
        email: users.email,
      }
    })
    .from(notes)
    .innerJoin(users, eq(notes.userId, users.id))
    .where(
      and(
        eq(notes.contactId, contactId),
        eq(notes.organizationId, orgId)
      )
    )
    .orderBy(asc(notes.createdAt));

    const contactActivities = await db.select({
      id: activities.id,
      type: activities.type,
      description: activities.description,
      createdAt: activities.createdAt,
      user: {
        email: users.email,
      }
    })
    .from(activities)
    .leftJoin(users, eq(activities.userId, users.id))
    .where(
      and(
        eq(activities.contactId, contactId),
        eq(activities.organizationId, orgId)
      )
    )
    .orderBy(asc(activities.createdAt));

    const appliedTags = await db.select({
      id: tags.id,
      name: tags.name,
      color: tags.color,
    })
    .from(contactTags)
    .innerJoin(tags, eq(contactTags.tagId, tags.id))
    .where(eq(contactTags.contactId, contactId));

    return { success: true, contact, lead, notes: contactNotes, activities: contactActivities, tags: appliedTags };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function addContactNote(contactId: string, content: string) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    const [newNote] = await db.insert(notes).values({
      organizationId: orgId,
      contactId,
      userId: userSession.userId as string,
      content,
    }).returning();

    await db.insert(activities).values({
      organizationId: orgId,
      contactId,
      type: 'NOTE_ADDED',
      description: 'New manual note added by agent.',
      userId: userSession.userId as string,
    });

    revalidatePath('/dashboard/crm');
    return { success: true, note: newNote };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getOrgAgents() {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    const agents = await db.select({
      id: users.id,
      email: users.email,
      role: users.role,
    }).from(users).where(eq(users.organizationId, orgId));

    return { success: true, agents };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getOrgTags() {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    const orgTags = await db.select().from(tags).where(eq(tags.organizationId, orgId));
    return { success: true, tags: orgTags };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createOrgTag(name: string, color: string) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    const [newTag] = await db.insert(tags).values({
      organizationId: orgId,
      name,
      color,
    }).returning();

    return { success: true, tag: newTag };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function addTagToContact(contactId: string, tagId: string) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');

  try {
    await db.insert(contactTags).values({
      contactId,
      tagId,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function removeTagFromContact(contactId: string, tagId: string) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');

  try {
    await db.delete(contactTags).where(
      and(
        eq(contactTags.contactId, contactId),
        eq(contactTags.tagId, tagId)
      )
    );

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
