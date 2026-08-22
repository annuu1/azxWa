'use server';

import { db } from '@/shared/database';
import { aiSettings, contacts, activities, leads } from '@/shared/database/schema';
import { getSession } from '@/features/auth/lib/auth-utils';
import { eq, and, like } from 'drizzle-orm';
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
      [settings] = await db
        .insert(aiSettings)
        .values({
          organizationId: orgId,
          enabled: false,
          provider: 'groq',
          model: 'openai/gpt-oss-120b',
          apiKey: null,
          systemPrompt: 'You are a helpful customer engagement and sales assistant. Keep your responses concise, helpful, and friendly.',
        })
        .returning();
    }

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

    if (apiKey === '••••••••••••••••') {
      const [existing] = await db
        .select()
        .from(aiSettings)
        .where(eq(aiSettings.organizationId, orgId))
        .limit(1);
      finalApiKey = existing?.apiKey || null;
    }

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
export async function toggleContactAI(identifier: string, aiEnabled: boolean) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    let [targetContact] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, identifier))
      .limit(1);

    const targetWhatsappId = targetContact ? targetContact.whatsappId : identifier;
    const cleanNumber = targetWhatsappId.split('@')[0];

    const matchingContacts = await db
      .select()
      .from(contacts)
      .where(
        like(contacts.whatsappId, `%${cleanNumber}%`)
      );

    if (matchingContacts.length > 0) {
      for (const c of matchingContacts) {
        await db
          .update(contacts)
          .set({ aiEnabled, updatedAt: new Date() })
          .where(eq(contacts.id, c.id));
      }
    } else {
      const [newContact] = await db
        .insert(contacts)
        .values({
          organizationId: orgId,
          whatsappId: targetWhatsappId,
          name: cleanNumber,
          aiEnabled,
        })
        .returning();

      await db.insert(activities).values({
        organizationId: orgId,
        contactId: newContact.id,
        type: 'LEAD_UPDATE',
        description: `AI Chatbot auto-replies were manually ${aiEnabled ? 'ENABLED' : 'PAUSED'} by agent.`,
      });
      return { success: true };
    }

    if (matchingContacts[0]) {
      await db.insert(activities).values({
        organizationId: orgId,
        contactId: matchingContacts[0].id,
        type: 'LEAD_UPDATE',
        description: `AI Chatbot auto-replies were manually ${aiEnabled ? 'ENABLED' : 'PAUSED'} by agent.`,
      });
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Helper to fetch up to 30 historical messages from the engine and format them for the AI service
 */
async function fetchFormattedHistory(sessionId: string, chatId: string, limit = 30): Promise<{ role: 'user' | 'model'; content: string }[]> {
  try {
    const messages = await engineFetchMessages(sessionId, chatId, limit);
    if (!messages || messages.length === 0) return [];
    
    return messages
      .filter((msg: any) => Boolean(msg.body && typeof msg.body === 'string' && msg.body.trim()))
      .slice(-limit)
      .map((msg: any) => ({
        role: (msg.fromMe || msg.isFromMe ? 'model' : 'user') as 'user' | 'model',
        content: msg.body as string,
      }));
  } catch (err) {
    console.error('[ai-actions] fetchFormattedHistory error:', err);
    return [];
  }
}

/**
 * Fetch an AI suggested reply for the current chat (with up to 30 historical messages)
 */
export async function getAISuggestedReplyAction(sessionId: string, chatId: string) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    const history = await fetchFormattedHistory(sessionId, chatId, 30);
    const suggestion = await generateSuggestedReply(orgId, history);
    return { success: true, suggestion };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Fetch a summary of the current conversation (with up to 30 historical messages)
 */
export async function getConversationSummaryAction(sessionId: string, chatId: string) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    const history = await fetchFormattedHistory(sessionId, chatId, 30);
    if (history.length === 0) {
      return { success: true, summary: 'No chat history available to summarize.' };
    }
    const summary = await generateConversationSummary(orgId, history);
    return { success: true, summary };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Parse chat history and qualify lead data to update CRM (with up to 30 historical messages)
 */
export async function getQualifiedLeadAction(sessionId: string, chatId: string) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    const history = await fetchFormattedHistory(sessionId, chatId, 30);
    if (history.length === 0) {
      return { success: false, error: 'No chat history available to qualify.' };
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
    const cleanNumber = whatsappId.split('@')[0];
    const matchingContacts = await db
      .select()
      .from(contacts)
      .where(
        like(contacts.whatsappId, `%${cleanNumber}%`)
      );

    let contact = matchingContacts[0];

    if (!contact) {
      [contact] = await db
        .insert(contacts)
        .values({
          organizationId: orgId,
          whatsappId,
          name: cleanNumber,
          aiEnabled: true,
        })
        .returning();
      return { success: true, aiEnabled: true, contactId: contact.id };
    }

    const isAiDisabled = matchingContacts.some(
      (c) => !c.aiEnabled || Number(c.aiEnabled) === 0 || c.aiEnabled === false
    );
    return { success: true, aiEnabled: !isAiDisabled, contactId: contact.id };
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
      }).returning();
    }

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
