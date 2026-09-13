import { db } from '@/shared/database';
import { 
  organizations, 
  contacts, 
  leads, 
  pipelines, 
  pipelineStages, 
  activities, 
  whatsappSessions, 
  aiSettings,
  tags as tagsTable,
  contactTags
} from '@/shared/database/schema';
import { eq, and, or, asc } from 'drizzle-orm';
import { assignLeadRoundRobin } from './lead-assignment';
import { queueLeadAnalysis } from '@/features/ai/lib/multi-agent/lead-analysis-queue';
import { findBrochureOrDocumentMatch } from '@/features/knowledge-base/lib/kb-service';
import { 
  sendMessage as engineSendMessage, 
  sendMediaMessage as engineSendMediaMessage,
  sendStateTyping
} from '@/features/whatsapp/lib/whatsapp-service';
import { realtimeBus } from '@/features/whatsapp/lib/realtime-bus';

export interface InboundLeadPayload {
  name?: string;
  fullName?: string;
  full_name?: string;
  first_name?: string;
  firstName?: string;
  last_name?: string;
  lastName?: string;
  phone?: string;
  phoneNumber?: string;
  phone_number?: string;
  mobile?: string;
  whatsapp?: string;
  wa_number?: string;
  contact?: string;
  email?: string;
  emailAddress?: string;
  source?: string;
  utm_source?: string;
  campaign?: string;
  campaignName?: string;
  campaign_name?: string;
  utm_campaign?: string;
  message?: string;
  notes?: string;
  inquiry?: string;
  comments?: string;
  welcomeMessage?: string;
  tags?: string[] | string;
  tag?: string;
  autoEngage?: boolean;
  auto_engage?: boolean;
  [key: string]: any;
}

export interface InboundLeadResult {
  success: boolean;
  message?: string;
  lead?: {
    id: string;
    contactId: string;
    name: string;
    phone: string;
    whatsappId: string;
    source: string;
    assignedTo?: string | null;
    whatsappEngaged: boolean;
  };
  error?: string;
  status: number;
}

/**
 * Normalizes any phone number string into clean digits & WhatsApp JID format
 */
export function normalizePhoneNumber(rawPhone: string): { digits: string; jid: string } | null {
  if (!rawPhone || typeof rawPhone !== 'string') return null;

  // Strip all non-digit characters
  let digits = rawPhone.replace(/\D/g, '');

  if (!digits || digits.length < 7) {
    return null;
  }

  // If 10 digits (common in India or US without country code), default prefix with 91 for Indian leads or keep clean
  if (digits.length === 10) {
    // Default to Indian country code 91 if standard 10 digits starting with 6-9
    if (/^[6-9]/.test(digits)) {
      digits = '91' + digits;
    }
  }

  return {
    digits,
    jid: `${digits}@c.us`,
  };
}

/**
 * Process inbound ad lead webhook from Meta Ads, Google Ads, Zapier, Webflow, Landing Pages.
 */
export async function processInboundLeadWebhook(
  identifier: string,
  payload: InboundLeadPayload
): Promise<InboundLeadResult> {
  try {
    if (!identifier || !identifier.trim()) {
      return { success: false, status: 401, error: 'Missing organization webhook token or ID.' };
    }

    // 1. Resolve Organization by webhookToken or primary UUID
    const cleanIdentifier = identifier.trim();
    const [org] = await db
      .select()
      .from(organizations)
      .where(
        or(
          eq(organizations.webhookToken, cleanIdentifier),
          eq(organizations.id, cleanIdentifier)
        )
      )
      .limit(1);

    if (!org) {
      console.warn(`[InboundWebhook] Unauthorized access attempt with token/id: ${cleanIdentifier}`);
      return { success: false, status: 404, error: 'Organization not found for provided webhook token or ID.' };
    }

    const orgId = org.id;

    // 2. Extract and Normalize Lead Details
    const rawName = 
      payload.name || 
      payload.fullName || 
      payload.full_name || 
      `${payload.first_name || payload.firstName || ''} ${payload.last_name || payload.lastName || ''}`.trim() || 
      'New Inbound Lead';

    const rawPhone = 
      payload.phone || 
      payload.phoneNumber || 
      payload.phone_number || 
      payload.mobile || 
      payload.whatsapp || 
      payload.wa_number || 
      payload.contact || 
      payload.entry?.[0]?.changes?.[0]?.value?.leadgen_id;

    if (!rawPhone || typeof rawPhone !== 'string') {
      return { 
        success: false, 
        status: 400, 
        error: 'Missing required phone number field (expected phone, phoneNumber, mobile, or whatsapp).' 
      };
    }

    const normalizedPhone = normalizePhoneNumber(rawPhone);
    if (!normalizedPhone) {
      return { 
        success: false, 
        status: 400, 
        error: `Invalid phone number format: "${rawPhone}". At least 7 numeric digits required.` 
      };
    }

    const contactWhatsappId = normalizedPhone.jid;
    const cleanDigits = normalizedPhone.digits;
    const email = payload.email || payload.emailAddress || null;
    const sourcePlatform = payload.source || payload.utm_source || 'Inbound Ad Webhook';
    const campaignName = payload.campaign || payload.campaignName || payload.campaign_name || payload.utm_campaign || '';
    const fullSource = campaignName ? `${sourcePlatform} (${campaignName})` : sourcePlatform;
    const leadNotes = payload.notes || payload.message || payload.inquiry || payload.comments || '';
    const shouldAutoEngage = payload.autoEngage !== false && payload.auto_engage !== false;

    // 3. Resolve or Create CRM Contact
    let [contact] = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.organizationId, orgId),
          or(
            eq(contacts.whatsappId, contactWhatsappId),
            eq(contacts.whatsappId, `${cleanDigits}@lid`)
          )
        )
      )
      .limit(1);

    if (contact) {
      // Update contact if new name or email provided
      if (rawName !== 'New Inbound Lead' && contact.name !== rawName) {
        await db
          .update(contacts)
          .set({ name: rawName, updatedAt: new Date() })
          .where(eq(contacts.id, contact.id));
      }
    } else {
      [contact] = await db
        .insert(contacts)
        .values({
          organizationId: orgId,
          whatsappId: contactWhatsappId,
          name: rawName,
          pushName: rawName,
          isGroup: false,
          aiEnabled: true,
        })
        .returning();
      console.log(`[InboundWebhook] Created CRM contact: ${contact.name} (${contactWhatsappId}) for org ${org.name}`);
    }

    // 4. Attach Tags (e.g. "Facebook Ads", Campaign, custom tags)
    const tagsToApply: string[] = [];
    if (sourcePlatform) tagsToApply.push(sourcePlatform);
    if (campaignName) tagsToApply.push(campaignName);

    if (Array.isArray(payload.tags)) {
      tagsToApply.push(...payload.tags);
    } else if (typeof payload.tags === 'string' && payload.tags.trim()) {
      tagsToApply.push(...payload.tags.split(',').map((t: string) => t.trim()));
    } else if (payload.tag && typeof payload.tag === 'string') {
      tagsToApply.push(payload.tag.trim());
    }

    for (const tagName of Array.from(new Set(tagsToApply)).filter(Boolean)) {
      try {
        let [tagRecord] = await db
          .select()
          .from(tagsTable)
          .where(and(eq(tagsTable.organizationId, orgId), eq(tagsTable.name, tagName)))
          .limit(1);

        if (!tagRecord) {
          [tagRecord] = await db
            .insert(tagsTable)
            .values({
              organizationId: orgId,
              name: tagName,
              color: '#3b82f6',
            })
            .returning();
        }

        // Link tag to contact
        const [existingLink] = await db
          .select()
          .from(contactTags)
          .where(and(eq(contactTags.contactId, contact.id), eq(contactTags.tagId, tagRecord.id)))
          .limit(1);

        if (!existingLink) {
          await db.insert(contactTags).values({
            contactId: contact.id,
            tagId: tagRecord.id,
          });
        }
      } catch (tagErr: any) {
        // Non-blocking
      }
    }

    // 5. Resolve or Auto-Create CRM Pipeline Lead
    let leadId: string;
    let [existingLead] = await db
      .select({ id: leads.id, assignedUserId: leads.assignedUserId })
      .from(leads)
      .where(and(eq(leads.contactId, contact.id), eq(leads.organizationId, orgId)))
      .limit(1);

    let assignedAgentEmail: string | null = null;

    if (existingLead) {
      leadId = existingLead.id;
      // If previously unassigned, assign via Round-Robin
      if (!existingLead.assignedUserId) {
        const assigned = await assignLeadRoundRobin(orgId, leadId);
        assignedAgentEmail = assigned?.email || null;
      }
    } else {
      // Find the first stage of the organization's pipeline
      const [firstStage] = await db
        .select({ id: pipelineStages.id })
        .from(pipelineStages)
        .innerJoin(pipelines, eq(pipelineStages.pipelineId, pipelines.id))
        .where(eq(pipelines.organizationId, orgId))
        .orderBy(asc(pipelineStages.position))
        .limit(1);

      if (!firstStage) {
        return { success: false, status: 500, error: 'Organization has no active pipeline stages.' };
      }

      const [newLead] = await db
        .insert(leads)
        .values({
          organizationId: orgId,
          contactId: contact.id,
          stageId: firstStage.id,
          status: 'NEW',
          source: fullSource,
        })
        .returning({ id: leads.id });

      leadId = newLead.id;

      // Auto-assign new lead evenly via Balanced Round-Robin
      const assigned = await assignLeadRoundRobin(orgId, leadId);
      assignedAgentEmail = assigned?.email || null;
    }

    // 6. Record Inbound Lead Capture in CRM Activities Timeline
    const activityDesc = `🎯 Inbound Ad Lead Captured from ${fullSource}${email ? ` | Email: ${email}` : ''}${leadNotes ? ` | Note: "${leadNotes}"` : ''}`;
    await db.insert(activities).values({
      organizationId: orgId,
      contactId: contact.id,
      type: 'NOTE',
      description: activityDesc,
    });

    // 7. Instant WhatsApp Engagement Outreach
    let whatsappEngaged = false;
    if (shouldAutoEngage) {
      try {
        const [connectedSession] = await db
          .select()
          .from(whatsappSessions)
          .where(and(eq(whatsappSessions.organizationId, orgId), eq(whatsappSessions.status, 'CONNECTED')))
          .limit(1);

        if (connectedSession) {
          const [aiConfig] = await db
            .select()
            .from(aiSettings)
            .where(eq(aiSettings.organizationId, orgId))
            .limit(1);

          const agentName = aiConfig?.agentName || 'Riya';
          const companyName = aiConfig?.companyName || org.name;
          const firstName = rawName.split(' ')[0] || 'there';

          // Natural, warm, human welcome greeting
          let welcomeText = payload.welcomeMessage?.trim();
          if (!welcomeText && aiConfig?.inboundAdPrompt?.trim()) {
            welcomeText = aiConfig.inboundAdPrompt
              .replace(/{{firstName}}/gi, firstName)
              .replace(/{{name}}/gi, rawName)
              .replace(/{{companyName}}/gi, companyName)
              .replace(/{{agentName}}/gi, agentName)
              .replace(/{{campaignName}}/gi, campaignName || fullSource)
              .replace(/{{leadNotes}}/gi, leadNotes || '')
              .replace(/{{source}}/gi, fullSource);
          }
          if (!welcomeText) {
            welcomeText = `Hi ${firstName}! 👋 Thanks for your interest in ${campaignName || fullSource}.\n\nI'm ${agentName} from ${companyName}. How can I help you with details today?`;
            if (leadNotes) {
              welcomeText = `Hi ${firstName}! 👋 Thanks for reaching out about ${campaignName || fullSource}.\n\nI noticed you were interested in "${leadNotes}". How can I best assist you today?`;
            }
          }

          // Check if lead asked for brochure / floorplan / document & auto-dispatch
          try {
            const brochureMatch = await findBrochureOrDocumentMatch(orgId, `${leadNotes} ${campaignName} ${fullSource}`);
            if (brochureMatch?.mediaUrl) {
              console.log(`[InboundWebhook] 📎 Auto-dispatching brochure to new lead ${contactWhatsappId}: ${brochureMatch.mediaUrl}`);
              await engineSendMediaMessage(
                connectedSession.sessionId,
                contactWhatsappId,
                brochureMatch.mediaUrl,
                brochureMatch.title ? `📄 ${brochureMatch.title}` : undefined
              );
              await db.insert(activities).values({
                organizationId: orgId,
                contactId: contact.id,
                type: 'MESSAGE_SENT',
                description: `Auto-dispatched brochure/document to ad lead: "${brochureMatch.title || brochureMatch.mediaUrl}"`,
              });
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          } catch (docErr: any) {
            console.warn('[InboundWebhook] Brochure match non-blocking error:', docErr.message);
          }

          // Typing delay for WhatsApp safety
          try {
            await sendStateTyping(connectedSession.sessionId, contactWhatsappId);
            await new Promise((resolve) => setTimeout(resolve, 1200));
          } catch {}

          // Send WhatsApp Welcome Message
          await engineSendMessage(connectedSession.sessionId, contactWhatsappId, welcomeText);
          whatsappEngaged = true;

          // Log in CRM activities & emit real-time event bus
          await db.insert(activities).values({
            organizationId: orgId,
            contactId: contact.id,
            type: 'MESSAGE_SENT',
            description: `Instant Ad Welcome WhatsApp sent by ${agentName}: "${welcomeText.substring(0, 80)}..."`,
          });

          realtimeBus.emitMessageSent(orgId, connectedSession.sessionId, {
            id: { _serialized: `ad-welcome-${Date.now()}` },
            from: connectedSession.sessionId,
            to: contactWhatsappId,
            fromMe: true,
            body: welcomeText,
            timestamp: Math.floor(Date.now() / 1000),
          });

          console.log(`[InboundWebhook] 🚀 Instant WhatsApp Welcome sent to ${contactWhatsappId} for org ${org.name}`);
        } else {
          console.log(`[InboundWebhook] No CONNECTED WhatsApp session for org ${org.name}. Skipping instant WhatsApp message.`);
        }
      } catch (waErr: any) {
        console.error(`[InboundWebhook] WhatsApp outreach error:`, waErr.message);
      }
    }

    // 8. Enroll in 120-second debounced autonomous AI profiling
    queueLeadAnalysis(orgId, leadId, 120000);

    return {
      success: true,
      status: 200,
      message: 'Inbound lead ingested, assigned, and engaged successfully.',
      lead: {
        id: leadId,
        contactId: contact.id,
        name: contact.name || rawName,
        phone: cleanDigits,
        whatsappId: contactWhatsappId,
        source: fullSource,
        assignedTo: assignedAgentEmail,
        whatsappEngaged,
      },
    };
  } catch (err: any) {
    console.error('[InboundWebhook] Fatal error processing inbound lead:', err);
    return {
      success: false,
      status: 500,
      error: err.message || 'Internal server error processing inbound lead.',
    };
  }
}
