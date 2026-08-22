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
  // 1. Sanitize history items
  const rawList = history
    .filter(h => Boolean(h.content && typeof h.content === 'string' && h.content.trim()))
    .map(h => {
      let text = h.content || '';
      if (text.includes('</think>')) {
        text = text.split('</think>').pop() || text;
      }
      text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      return {
        role: (h.role === 'model' ? 'assistant' : 'user') as 'assistant' | 'user',
        content: text,
      };
    });

  if (incomingMessage) {
    let cleanIncoming = incomingMessage;
    if (cleanIncoming.includes('</think>')) {
      cleanIncoming = cleanIncoming.split('</think>').pop() || cleanIncoming;
    }
    cleanIncoming = cleanIncoming.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    if (cleanIncoming) {
      rawList.push({ role: 'user', content: cleanIncoming });
    }
  }

  // 2. Merge consecutive messages of the same role for clean LLM prompt context
  const mergedMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemPrompt }
  ];

  for (const item of rawList) {
    const last = mergedMessages[mergedMessages.length - 1];
    if (last && last.role === item.role) {
      last.content += '\n' + item.content;
    } else {
      mergedMessages.push(item);
    }
  }

  // Auto-normalize model if deprecated llama model string was passed for Groq
  let targetModel = model;
  if (url.includes('groq.com') && (!targetModel || targetModel.includes('llama') || targetModel === 'qwen/qwen3.6-27b')) {
    targetModel = 'openai/gpt-oss-120b';
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'HTTP-Referer': process.env.APP_URL || 'http://localhost:9091',
      'X-Title': 'compuX',
    },
    body: JSON.stringify({
      model: targetModel,
      messages: mergedMessages,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    let parsedMsg = errText;
    try {
      const parsed = JSON.parse(errText);
      if (parsed.error?.message) parsedMsg = parsed.error.message;
    } catch (e) {}
    throw new Error(`API Error (${response.status}): ${parsedMsg}`);
  }

  const data = await response.json();
  let content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('API returned an empty completion response.');
  }

  // Strip reasoning <think>...</think> blocks if present in model output
  if (content.includes('</think>')) {
    content = content.split('</think>').pop() || content;
  }
  content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

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

  if (!primaryModel || (primaryProvider === 'groq' && (primaryModel.includes('llama') || primaryModel === 'qwen/qwen3.6-27b'))) {
    primaryModel = primaryProvider === 'groq' ? 'openai/gpt-oss-120b' : 'meta-llama/llama-3.3-70b-instruct';
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

    if (primaryProvider === 'groq') {
      const fallbackApiKey = process.env.AI_API_KEY || settings.apiKey || '';
      const fallbackModel = 'meta-llama/llama-3.3-70b-instruct';
      
      if (!fallbackApiKey || fallbackApiKey.startsWith('gsk_')) {
        console.warn('[AI Service] Fallback to OpenRouter skipped: No OpenRouter AI_API_KEY configured.');
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
    ? `${settings.systemPrompt}\n\nINSTRUCTION: Suggest a suitable, professional next message or reply to the user. Keep it natural and ready-to-send. Do not wrap in quotes or code blocks.` 
    : 'You are a customer service assistant. Suggest a suitable next reply for the customer. Do not include quotes or meta text.';

  const systemPrompt = basePrompt + kbContext;
  
  const provider = settings?.provider || 'groq';
  let model = settings?.model || (provider === 'groq' ? 'openai/gpt-oss-120b' : 'meta-llama/llama-3.3-70b-instruct');
  if (!model || (provider === 'groq' && (model.includes('llama') || model === 'qwen/qwen3.6-27b'))) {
    model = provider === 'groq' ? 'openai/gpt-oss-120b' : 'meta-llama/llama-3.3-70b-instruct';
  }
  const apiKey = settings?.apiKey || process.env.AI_API_KEY || '';
  const url = provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';

  return await fetchCompletions(url, apiKey, model, systemPrompt, history);
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

  const systemPrompt = 'Analyze the following chat transcript and provide a short bulleted summary (2-3 sentences max) highlighting user interest and status. Respond directly with the bullet points.';
  const provider = settings?.provider || 'groq';
  let model = settings?.model || (provider === 'groq' ? 'openai/gpt-oss-120b' : 'meta-llama/llama-3.3-70b-instruct');
  if (!model || (provider === 'groq' && (model.includes('llama') || model === 'qwen/qwen3.6-27b'))) {
    model = provider === 'groq' ? 'openai/gpt-oss-120b' : 'meta-llama/llama-3.3-70b-instruct';
  }
  const apiKey = settings?.apiKey || process.env.AI_API_KEY || '';
  const url = provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';

  return await fetchCompletions(url, apiKey, model, systemPrompt, history);
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
  let model = settings?.model || (provider === 'groq' ? 'openai/gpt-oss-120b' : 'meta-llama/llama-3.3-70b-instruct');
  if (!model || (provider === 'groq' && (model.includes('llama') || model === 'qwen/qwen3.6-27b'))) {
    model = provider === 'groq' ? 'openai/gpt-oss-120b' : 'meta-llama/llama-3.3-70b-instruct';
  }
  const apiKey = settings?.apiKey || process.env.AI_API_KEY || '';
  const url = provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';

  try {
    const jsonText = await fetchCompletions(url, apiKey, model, systemPrompt, history);
    
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
