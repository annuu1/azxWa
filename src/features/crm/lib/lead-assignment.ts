import { db } from '@/shared/database';
import { leads, users, activities } from '@/shared/database/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';

export interface AssignedAgentInfo {
  id: string;
  email: string;
  role: string;
}

/**
 * Assign a lead to an active team member using a balanced Round-Robin algorithm.
 * Selects the agent/admin with the lowest current workload (least assigned leads).
 */
export async function assignLeadRoundRobin(
  organizationId: string,
  leadId: string
): Promise<AssignedAgentInfo | null> {
  try {
    // 1. Fetch the lead to verify existence and get contactId
    const [targetLead] = await db
      .select({
        id: leads.id,
        contactId: leads.contactId,
        assignedUserId: leads.assignedUserId,
      })
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.organizationId, organizationId)))
      .limit(1);

    if (!targetLead) {
      console.warn(`[RoundRobin] Lead ${leadId} not found in org ${organizationId}`);
      return null;
    }

    // 2. Fetch all eligible team members (ORG_ADMIN or AGENT) for this organization
    const eligibleUsers = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(
        and(
          eq(users.organizationId, organizationId),
          inArray(users.role, ['ORG_ADMIN', 'AGENT'])
        )
      );

    if (eligibleUsers.length === 0) {
      console.warn(`[RoundRobin] No eligible agents/admins found for org ${organizationId}`);
      return null;
    }

    // 3. Calculate current workload per user
    const userWorkloads = await Promise.all(
      eligibleUsers.map(async (u) => {
        const [res] = await db
          .select({ count: sql<number>`count(*)` })
          .from(leads)
          .where(
            and(
              eq(leads.organizationId, organizationId),
              eq(leads.assignedUserId, u.id)
            )
          );
        return {
          user: u,
          count: Number(res?.count || 0),
        };
      })
    );

    // 4. Sort by least assigned leads, then by member seniority
    userWorkloads.sort((a, b) => {
      if (a.count !== b.count) {
        return a.count - b.count;
      }
      const timeA = a.user.createdAt ? new Date(a.user.createdAt).getTime() : 0;
      const timeB = b.user.createdAt ? new Date(b.user.createdAt).getTime() : 0;
      return timeA - timeB;
    });

    const chosen = userWorkloads[0].user;

    // 5. Update lead assignment
    await db
      .update(leads)
      .set({
        assignedUserId: chosen.id,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, leadId));

    // 6. Log assignment activity in CRM timeline
    await db.insert(activities).values({
      organizationId,
      contactId: targetLead.contactId,
      type: 'NOTE',
      description: `Autonomous Round-Robin: Lead automatically assigned to ${chosen.email} (workload: ${userWorkloads[0].count} leads).`,
    });

    console.log(`[RoundRobin] Successfully assigned lead ${leadId} to ${chosen.email}`);
    return {
      id: chosen.id,
      email: chosen.email,
      role: chosen.role,
    };
  } catch (err: any) {
    console.error(`[RoundRobin] Error assigning lead ${leadId}:`, err.message);
    return null;
  }
}
