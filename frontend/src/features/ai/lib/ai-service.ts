import { db } from '@/shared/database';
import { aiSettings } from '@/shared/database/schema';
import { eq } from 'drizzle-orm';
import { queryKnowledgeBase } from '@/features/knowledge-base/lib/kb-service';

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

// Helper to make a standard completions call to Groq or OpenRouter
async function fetchCompletions(
  url: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  history: ChatMessage[],
  incomingMessage?: string
): Promise<string> {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(h => ({
      role: h.role === 'model' ? 'assistant' : 'user',
      content: h.content,
    })),
  ];

  if (incomingMessage) {
    messages.push({ role: 'user', content: incomingMessage });
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.APP_URL || 'http://localhost:3001',
      'X-Title': 'compuX',
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API Error (${response.status}): ${errText || response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('API returned an empty completion response.');
  }

  return content.trim();
}

/**
 * Generate AI Response for Auto-Reply
 */
export async function generateAIResponse(
  organizationId: string,
  history: ChatMessage[],
  incomingMessage: string
): Promise<string | null> {
  const [settings] = await db
    .select()
    .from(aiSettings)
    .where(eq(aiSettings.organizationId, organizationId))
    .limit(1);

  if (!settings || !settings.enabled) {
    return null;
  }

  // Retrieve knowledge base context if available
  let kbContext = '';
  try {
    const chunks = await queryKnowledgeBase(organizationId, incomingMessage);
    if (chunks && chunks.length > 0) {
      kbContext = "\n\nUse the following context from the Knowledge Base/FAQs to answer the user's inquiry. If the information is not present in the context, answer based on your general knowledge but prefer the context if relevant:\n" +
        chunks.map(c => `Source: ${c.title || 'FAQ/Document'}\nContent: ${c.content}`).join('\n---\n');
    }
  } catch (kbErr: any) {
    console.error('[AI Service] KB retrieval error:', kbErr.message);
  }

  const systemPrompt = settings.systemPrompt + kbContext;
  const primaryProvider = settings.provider;
  let primaryModel = settings.model;
  let primaryApiKey = settings.apiKey || process.env.AI_API_KEY || '';

  // Determine standard model names if placeholders are used
  if (primaryModel === 'llama-3.8b-instant') {
    primaryModel = primaryProvider === 'groq' ? 'llama-3.1-8b-instant' : 'meta-llama/llama-3.1-8b-instruct';
  }

  console.log(`[AI Service] Attempting response generation using ${primaryProvider} (${primaryModel})...`);

  try {
    if (primaryProvider === 'groq') {
      if (!primaryApiKey) {
        throw new Error('Groq API Key is not configured.');
      }
      return await fetchCompletions(
        'https://api.groq.com/openai/v1/chat/completions',
        primaryApiKey,
        primaryModel,
        systemPrompt,
        history,
        incomingMessage
      );
    } else {
      // OpenRouter
      if (!primaryApiKey) {
        throw new Error('OpenRouter API Key is not configured.');
      }
      return await fetchCompletions(
        'https://openrouter.ai/api/v1/chat/completions',
        primaryApiKey,
        primaryModel,
        systemPrompt,
        history,
        incomingMessage
      );
    }
  } catch (err: any) {
    console.error(`[AI Service] Primary provider ${primaryProvider} failed:`, err.message);

    // Fallback logic to OpenRouter if primary was groq
    if (primaryProvider === 'groq') {
      const fallbackApiKey = process.env.AI_API_KEY || settings.apiKey || '';
      const fallbackModel = 'meta-llama/llama-3.1-8b-instruct';
      
      if (!fallbackApiKey) {
        console.warn('[AI Service] Fallback to OpenRouter skipped: No global AI_API_KEY configured.');
        throw err;
      }

      console.log(`[AI Service] Triggering Fallback to OpenRouter (${fallbackModel})...`);
      try {
        return await fetchCompletions(
          'https://openrouter.ai/api/v1/chat/completions',
          fallbackApiKey,
          fallbackModel,
          systemPrompt,
          history,
          incomingMessage
        );
      } catch (fallbackErr: any) {
        console.error('[AI Service] Fallback to OpenRouter failed:', fallbackErr.message);
        throw fallbackErr;
      }
    }

    throw err;
  }
}

/**
 * Generate AI Suggested Reply for agent in Inbox
 */
export async function generateSuggestedReply(
  organizationId: string,
  history: ChatMessage[]
): Promise<string> {
  const [settings] = await db
    .select()
    .from(aiSettings)
    .where(eq(aiSettings.organizationId, organizationId))
    .limit(1);

  // Retrieve knowledge base context if available
  let kbQuery = '';
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === 'user') {
      kbQuery = history[i].content;
      break;
    }
  }

  let kbContext = '';
  if (kbQuery) {
    try {
      const chunks = await queryKnowledgeBase(organizationId, kbQuery);
      if (chunks && chunks.length > 0) {
        kbContext = "\n\nUse the following context from the Knowledge Base/FAQs to answer the user's inquiry:\n" +
          chunks.map(c => `Source: ${c.title || 'FAQ/Document'}\nContent: ${c.content}`).join('\n---\n');
      }
    } catch (kbErr: any) {
      console.error('[AI Service] KB retrieval error:', kbErr.message);
    }
  }

  const basePrompt = settings?.systemPrompt 
    ? `${settings.systemPrompt}\n\nINSTRUCTION: Suggest a suitable, professional next message or reply to the user. Keep it natural and ready-to-send.` 
    : 'You are a customer service assistant. Suggest a suitable next reply for the customer. Do not include quotes or meta text.';

  const systemPrompt = basePrompt + kbContext;
  
  const provider = settings?.provider || 'groq';
  let model = settings?.model || (provider === 'groq' ? 'llama-3.1-8b-instant' : 'meta-llama/llama-3.1-8b-instruct');
  if (model === 'llama-3.8b-instant') {
    model = provider === 'groq' ? 'llama-3.1-8b-instant' : 'meta-llama/llama-3.1-8b-instruct';
  }
  const apiKey = settings?.apiKey || process.env.AI_API_KEY || '';

  const url = provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';

  try {
    return await fetchCompletions(url, apiKey, model, systemPrompt, history);
  } catch (err: any) {
    // Fallback if groq fails
    if (provider === 'groq' && process.env.AI_API_KEY) {
      return await fetchCompletions(
        'https://openrouter.ai/api/v1/chat/completions',
        process.env.AI_API_KEY,
        'meta-llama/llama-3.1-8b-instruct',
        systemPrompt,
        history
      );
    }
    throw err;
  }
}

/**
 * Generate Conversation Summary
 */
export async function generateConversationSummary(
  organizationId: string,
  history: ChatMessage[]
): Promise<string> {
  const [settings] = await db
    .select()
    .from(aiSettings)
    .where(eq(aiSettings.organizationId, organizationId))
    .limit(1);

  const systemPrompt = 'Analyze the following chat transcript and provide a very short, bulleted summary (2-3 sentences max) highlighting the user interest and current status.';
  const provider = settings?.provider || 'groq';
  let model = settings?.model || (provider === 'groq' ? 'llama-3.1-8b-instant' : 'meta-llama/llama-3.1-8b-instruct');
  if (model === 'llama-3.8b-instant') {
    model = provider === 'groq' ? 'llama-3.1-8b-instant' : 'meta-llama/llama-3.1-8b-instruct';
  }
  const apiKey = settings?.apiKey || process.env.AI_API_KEY || '';
  const url = provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';

  try {
    return await fetchCompletions(url, apiKey, model, systemPrompt, history);
  } catch (err: any) {
    if (provider === 'groq' && process.env.AI_API_KEY) {
      return await fetchCompletions(
        'https://openrouter.ai/api/v1/chat/completions',
        process.env.AI_API_KEY,
        'meta-llama/llama-3.1-8b-instruct',
        systemPrompt,
        history
      );
    }
    throw err;
  }
}

/**
 * Parse Conversation to Qualify CRM Lead
 */
export async function qualifyLeadFromChat(
  organizationId: string,
  history: ChatMessage[]
): Promise<{ name?: string; email?: string; notes?: string }> {
  const [settings] = await db
    .select()
    .from(aiSettings)
    .where(eq(aiSettings.organizationId, organizationId))
    .limit(1);

  const systemPrompt = `Analyze the conversation history. Extract the client's information if mentioned. Respond ONLY with a valid JSON object. Do not include markdown formatting or markdown code blocks.
  
  JSON fields:
  {
    "name": "full name of user if found, or null",
    "email": "email address of user if found, or null",
    "notes": "brief summary of user preferences, budget, or timeline if found, or null"
  }`;

  const provider = settings?.provider || 'groq';
  let model = settings?.model || (provider === 'groq' ? 'llama-3.1-8b-instant' : 'meta-llama/llama-3.1-8b-instruct');
  if (model === 'llama-3.8b-instant') {
    model = provider === 'groq' ? 'llama-3.1-8b-instant' : 'meta-llama/llama-3.1-8b-instruct';
  }
  const apiKey = settings?.apiKey || process.env.AI_API_KEY || '';
  const url = provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';

  try {
    const jsonText = await fetchCompletions(url, apiKey, model, systemPrompt, history);
    
    // Clean up possible markdown code blocks if the AI disobeyed instructions
    let cleanJson = jsonText;
    if (jsonText.includes('```')) {
      cleanJson = jsonText.replace(/```json|```/g, '').trim();
    }
    
    return JSON.parse(cleanJson);
  } catch (err) {
    console.error('[AI Service] Failed to parse lead details:', err);
    return {};
  }
}
