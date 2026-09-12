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
  activities,
  leadIntelligence,
  aiActionProposals
} from '@/shared/database/schema';
import { getSession } from '@/features/auth/lib/auth-utils';
import { revalidatePath } from 'next/cache';
import { eq, and, asc, desc } from 'drizzle-orm';

// Lazy seed default pipeline and stages for an organization
async function ensureDefaultPipeline(orgId: string) {
  const [existingPipeline] = await db.select().from(pipelines).where(eq(pipelines.organizationId, orgId)).limit(1);
  if (existingPipeline) {
    const existingStages = await db.select().from(pipelineStages).where(eq(pipelineStages.pipelineId, existingPipeline.id));
    if (existingStages.length === 0) {
      const defaultStages = [
        { name: 'New', position: 1 },
        { name: 'Contacted', position: 2 },
        { name: 'Qualified', position: 3 },
        { name: 'Proposal', position: 4 },
        { name: 'Won', position: 5 },
        { name: 'Lost', position: 6 },
      ];
      for (const stage of defaultStages) {
        await db.insert(pipelineStages).values({
          pipelineId: existingPipeline.id,
          name: stage.name,
          position: stage.position,
        });
      }
    }
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
    
    // Batch fetch all leads for this org in one query
    const allLeads = await db.select({ contactId: leads.contactId, status: leads.status }).from(leads).where(eq(leads.organizationId, orgId));
    const leadMap = new Map<string, string>();
    for (const l of allLeads) {
      leadMap.set(l.contactId, l.status || 'NEW');
    }

    // Batch fetch all contact tags for this org in one query
    const allContactTags = await db.select({
      contactId: contactTags.contactId,
      id: tags.id,
      name: tags.name,
      color: tags.color,
    })
    .from(contactTags)
    .innerJoin(tags, eq(contactTags.tagId, tags.id))
    .where(eq(tags.organizationId, orgId));

    const tagsMap = new Map<string, Array<{ id: string; name: string; color: string }>>();
    for (const row of allContactTags) {
      if (!tagsMap.has(row.contactId)) tagsMap.set(row.contactId, []);
      tagsMap.get(row.contactId)!.push({ id: row.id, name: row.name, color: row.color });
    }

    const contactsWithTags = allContacts.map(c => ({
      ...c,
      isLead: leadMap.has(c.id),
      leadStatus: leadMap.get(c.id) || 'NONE',
      tags: tagsMap.get(c.id) || [],
    }));

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
    .where(eq(leads.organizationId, orgId))
    .orderBy(desc(leads.createdAt));

    // Batch fetch lead intelligence in one query
    const allIntel = await db.select().from(leadIntelligence).where(eq(leadIntelligence.organizationId, orgId));
    const intelMap = new Map();
    for (const intel of allIntel) {
      intelMap.set(intel.leadId, intel);
    }

    // Batch fetch pending action proposals in one query
    const allProposals = await db.select().from(aiActionProposals).where(
      and(
        eq(aiActionProposals.organizationId, orgId),
        eq(aiActionProposals.status, 'PENDING_APPROVAL')
      )
    );
    const proposalMap = new Map();
    for (const prop of allProposals) {
      if (!proposalMap.has(prop.leadId)) {
        proposalMap.set(prop.leadId, prop);
      }
    }

    // Batch fetch all contact tags in one query
    const allContactTags = await db.select({
      contactId: contactTags.contactId,
      id: tags.id,
      name: tags.name,
      color: tags.color,
    })
    .from(contactTags)
    .innerJoin(tags, eq(contactTags.tagId, tags.id))
    .where(eq(tags.organizationId, orgId));

    const tagsMap = new Map<string, Array<{ id: string; name: string; color: string }>>();
    for (const row of allContactTags) {
      if (!tagsMap.has(row.contactId)) tagsMap.set(row.contactId, []);
      tagsMap.get(row.contactId)!.push({ id: row.id, name: row.name, color: row.color });
    }

    const leadsWithTags = allLeads.map(l => ({
      ...l,
      tags: tagsMap.get(l.contact.id) || [],
      intelligence: intelMap.get(l.id) || null,
      pendingProposal: proposalMap.get(l.id) || null,
    }));

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

    let intelligence = null;
    let proposals: any[] = [];
    if (lead) {
      const [intel] = await db.select().from(leadIntelligence).where(eq(leadIntelligence.leadId, lead.id)).limit(1);
      intelligence = intel || null;
      proposals = await db.select().from(aiActionProposals).where(eq(aiActionProposals.leadId, lead.id)).orderBy(desc(aiActionProposals.createdAt)).limit(5);
    }

    return { 
      success: true, 
      contact, 
      lead, 
      notes: contactNotes, 
      activities: contactActivities, 
      tags: appliedTags,
      intelligence,
      proposals 
    };
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

export async function createLeadForContact(contactId: string, stageId?: string) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    const pipelineId = await ensureDefaultPipeline(orgId);
    const stagesList = await db.select().from(pipelineStages).where(eq(pipelineStages.pipelineId, pipelineId)).orderBy(asc(pipelineStages.position));

    if (stagesList.length === 0) {
      throw new Error('Default pipeline stages not configured');
    }

    const matchedStage = stagesList.find(s => s.id === stageId);
    const targetStageId = matchedStage ? matchedStage.id : stagesList[0].id;

    const [existingLead] = await db.select().from(leads).where(
      and(
        eq(leads.contactId, contactId),
        eq(leads.organizationId, orgId)
      )
    ).limit(1);

    if (existingLead) {
      await db.update(leads).set({ stageId: targetStageId, updatedAt: new Date() }).where(eq(leads.id, existingLead.id));
      revalidatePath('/dashboard/crm');
      return { success: true, lead: existingLead };
    }

    const [newLead] = await db.insert(leads).values({
      organizationId: orgId,
      contactId,
      stageId: targetStageId,
      status: 'NEW',
    }).returning();

    await db.insert(activities).values({
      organizationId: orgId,
      contactId,
      type: 'CONVERTED',
      description: 'Contact added to deal pipeline.',
      userId: userSession.userId as string,
    });

    revalidatePath('/dashboard/crm');
    return { success: true, lead: newLead };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createManualContactAndLead(data: { name: string; phone: string; stageId?: string; assignedUserId?: string }) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    const cleanPhone = data.phone.replace(/[^0-9]/g, '');
    if (!cleanPhone) throw new Error('Valid phone number is required');
    const whatsappId = cleanPhone.includes('@') ? cleanPhone : `${cleanPhone}@c.us`;

    // Find or create contact
    let [contact] = await db.select().from(contacts).where(
      and(
        eq(contacts.whatsappId, whatsappId),
        eq(contacts.organizationId, orgId)
      )
    ).limit(1);

    if (!contact) {
      const [newContact] = await db.insert(contacts).values({
        organizationId: orgId,
        whatsappId,
        name: data.name || cleanPhone,
        pushName: data.name || cleanPhone,
        aiEnabled: true,
      }).returning();
      contact = newContact;
    } else if (data.name && contact.name !== data.name) {
      await db.update(contacts).set({ name: data.name, updatedAt: new Date() }).where(eq(contacts.id, contact.id));
    }

    // Now create or update lead
    const result = await createLeadForContact(contact.id, data.stageId);
    if (!result.success) throw new Error(result.error);

    if (data.assignedUserId && data.assignedUserId !== 'unassigned' && result.lead) {
      await db.update(leads).set({ assignedUserId: data.assignedUserId }).where(eq(leads.id, result.lead.id));
    }

    revalidatePath('/dashboard/crm');
    return { success: true, contact, lead: result.lead };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function convertAllContactsToLeads() {
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

    const allContacts = await db.select().from(contacts).where(eq(contacts.organizationId, orgId));
    const existingLeads = await db.select().from(leads).where(eq(leads.organizationId, orgId));
    const existingContactIds = new Set(existingLeads.map(l => l.contactId));

    let createdCount = 0;
    for (const c of allContacts) {
      if (!existingContactIds.has(c.id)) {
        await db.insert(leads).values({
          organizationId: orgId,
          contactId: c.id,
          stageId: firstStageId,
          status: 'NEW',
        });
        createdCount++;
      }
    }

    revalidatePath('/dashboard/crm');
    return { success: true, count: createdCount };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function moveLeadStageStep(leadId: string, direction: 'prev' | 'next') {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    const pipelineId = await ensureDefaultPipeline(orgId);
    const stagesList = await db.select().from(pipelineStages).where(eq(pipelineStages.pipelineId, pipelineId)).orderBy(asc(pipelineStages.position));

    const [lead] = await db.select().from(leads).where(
      and(
        eq(leads.id, leadId),
        eq(leads.organizationId, orgId)
      )
    ).limit(1);

    if (!lead) throw new Error('Lead not found');

    const currentIndex = stagesList.findIndex(s => s.id === lead.stageId);
    let targetIndex = currentIndex;

    if (currentIndex === -1) {
      targetIndex = 0;
    } else if (direction === 'next' && currentIndex < stagesList.length - 1) {
      targetIndex = currentIndex + 1;
    } else if (direction === 'prev' && currentIndex > 0) {
      targetIndex = currentIndex - 1;
    }

    const targetStage = stagesList[targetIndex];
    if (targetStage && targetStage.id !== lead.stageId) {
      await db.update(leads).set({ stageId: targetStage.id, updatedAt: new Date() }).where(eq(leads.id, leadId));
      await db.insert(activities).values({
        organizationId: orgId,
        contactId: lead.contactId,
        type: 'LEAD_STAGE_CHANGED',
        description: `Lead moved ${direction === 'next' ? 'forward' : 'backward'} to stage: ${targetStage.name}`,
        userId: userSession.userId as string,
      });
    }

    revalidatePath('/dashboard/crm');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteLead(leadId: string) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    await db.delete(leads).where(
      and(
        eq(leads.id, leadId),
        eq(leads.organizationId, orgId)
      )
    );

    revalidatePath('/dashboard/crm');
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
