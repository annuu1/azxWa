'use server';

import { db } from '@/shared/database';
import { aiSettings, contacts, activities, leads } from '@/shared/database/schema';
import { getSession } from '@/features/auth/lib/auth-utils';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { fetchMessages as engineFetchMessages } from '@/features/whatsapp/lib/whatsapp-service';
import { 
  generateSuggestedReply, 
  generateConversationSummary, 
  qualifyLeadFromChat 
} from '../lib/ai-service';

/**
 * Fetch AI Settings for the current organization
 */
export async function getAISettingsData() {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    let [settings] = await db
      .select()
      .from(aiSettings)
      .where(eq(aiSettings.organizationId, orgId))
      .limit(1);

    if (!settings) {
      // Initialize default settings row for the organization
      [settings] = await db
        .insert(aiSettings)
        .values({
          organizationId: orgId,
          enabled: false,
          provider: 'groq',
          model: 'llama-3.8b-instant',
          apiKey: null,
          systemPrompt: 'You are a helpful customer engagement and sales assistant. Keep your responses concise, helpful, and friendly.',
        })
        .returning();
    }

    // Mask API Key before sending to frontend for security
    const maskedSettings = {
      ...settings,
      apiKey: settings.apiKey ? '••••••••••••••••' : '',
    };

    return { success: true, settings: maskedSettings };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Save AI Settings for the current organization
 */
export async function saveAISettings(
  enabled: boolean,
  provider: string,
  model: string,
  apiKey: string | null,
  systemPrompt: string
) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    let finalApiKey = apiKey;

    // If API key is masked, preserve the existing key stored in the database
    if (apiKey === '••••••••••••••••') {
      const [existing] = await db
        .select()
        .from(aiSettings)
        .where(eq(aiSettings.organizationId, orgId))
        .limit(1);
      finalApiKey = existing?.apiKey || null;
    }

    // Insert or update on conflict (organizationId is unique)
    await db
      .insert(aiSettings)
      .values({
        organizationId: orgId,
        enabled,
        provider,
        model,
        apiKey: finalApiKey || null,
        systemPrompt,
      })
      .onConflictDoUpdate({
        target: aiSettings.organizationId,
        set: {
          enabled,
          provider,
          model,
          apiKey: finalApiKey || null,
          systemPrompt,
          updatedAt: new Date(),
        },
      });

    revalidatePath('/dashboard/ai');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Toggle AI Chatbot status for a specific contact (Human Handoff Toggle)
 */
export async function toggleContactAI(contactId: string, aiEnabled: boolean) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    await db
      .update(contacts)
      .set({ aiEnabled, updatedAt: new Date() })
      .where(
        and(
          eq(contacts.id, contactId),
          eq(contacts.organizationId, orgId)
        )
      );

    // Log the toggle activity
    await db.insert(activities).values({
      organizationId: orgId,
      contactId: contactId,
      type: 'LEAD_UPDATE',
      description: `AI Chatbot auto-replies were manually ${aiEnabled ? 'ENABLED' : 'PAUSED'} by agent.`,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Helper to fetch last messages from the engine and format them for the AI service
 */
async function fetchFormattedHistory(sessionId: string, chatId: string, limit = 15) {
  const messages = await engineFetchMessages(sessionId, chatId, limit);
  if (!messages || messages.length === 0) return [];
  
  return messages
    .filter((msg: any) => msg.body && msg.type === 'chat')
    .map((msg: any) => ({
      role: msg.fromMe ? 'model' : 'user',
      content: msg.body,
    }));
}

/**
 * Fetch an AI suggested reply for the current chat
 */
export async function getAISuggestedReplyAction(sessionId: string, chatId: string) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    const history = await fetchFormattedHistory(sessionId, chatId, 10);
    const suggestion = await generateSuggestedReply(orgId, history);
    return { success: true, suggestion };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Fetch a summary of the current conversation
 */
export async function getConversationSummaryAction(sessionId: string, chatId: string) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    const history = await fetchFormattedHistory(sessionId, chatId, 25);
    if (history.length === 0) {
      return { success: true, summary: 'No chat history to summarize.' };
    }
    const summary = await generateConversationSummary(orgId, history);
    return { success: true, summary };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Parse chat history and qualify lead data to update CRM
 */
export async function getQualifiedLeadAction(sessionId: string, chatId: string) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    const history = await fetchFormattedHistory(sessionId, chatId, 25);
    if (history.length === 0) {
      return { success: false, error: 'No chat history to qualify.' };
    }
    const leadData = await qualifyLeadFromChat(orgId, history);
    return { success: true, leadData };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Fetch contact AI chatbot status and ID from CRM
 */
export async function getContactAIStatus(whatsappId: string) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    let [contact] = await db.select().from(contacts).where(
      and(
        eq(contacts.whatsappId, whatsappId),
        eq(contacts.organizationId, orgId)
      )
    ).limit(1);

    if (!contact) {
      // Create if it doesn't exist yet
      [contact] = await db.insert(contacts).values({
        organizationId: orgId,
        whatsappId,
        name: whatsappId.split('@')[0],
        aiEnabled: true,
      }).returning();
    }

    return { success: true, aiEnabled: contact.aiEnabled, contactId: contact.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Apply AI-extracted lead details directly to the CRM
 */
export async function saveQualifiedLeadDetails(
  contactId: string,
  name: string,
  email: string,
  notes: string
) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    // 1. Update Contact name
    if (name) {
      await db.update(contacts)
        .set({ name, updatedAt: new Date() })
        .where(
          and(
            eq(contacts.id, contactId),
            eq(contacts.organizationId, orgId)
          )
        );
    }

    // 2. Ensure contact is converted to a lead in Drizzle CRM
    let [lead] = await db.select().from(leads).where(
      and(
        eq(leads.contactId, contactId),
        eq(leads.organizationId, orgId)
      )
    ).limit(1);

    if (!lead) {
      [lead] = await db.insert(leads).values({
        organizationId: orgId,
        contactId,
        status: 'NEW',
        value: 0,
      }).returning();
    }

    // 3. Log AI Qualification details as a CRM activity note
    await db.insert(activities).values({
      organizationId: orgId,
      contactId,
      type: 'NOTE_CREATED',
      description: `AI Chatbot Auto-Qualification: Name: ${name || 'N/A'}, Email: ${email || 'N/A'}. Notes: "${notes || 'None'}"`,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
