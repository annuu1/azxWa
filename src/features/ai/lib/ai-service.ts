import { db } from '@/shared/database';
import { aiSettings } from '@/shared/database/schema';
import { eq } from 'drizzle-orm';
import { queryKnowledgeBase } from '@/features/knowledge-base/lib/kb-service';
import { PLATFORM_INFO } from '@/shared/config/platform';

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
      'HTTP-Referer': PLATFORM_INFO.appUrl,
      'X-Title': PLATFORM_INFO.name,
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
 * Convert markdown tables to clean, mobile-friendly WhatsApp bullet lists.
 * WhatsApp cannot render markdown tables; they appear broken and messy on mobile.
 */
export function convertMarkdownTablesToWhatsApp(text: string): string {
  if (!text || !text.includes('|')) return text;

  const lines = text.split('\n');
  const resultLines: string[] = [];
  let tableLines: string[] = [];
  let inTable = false;

  function flushTable(linesToProcess: string[]) {
    const nonSep = linesToProcess.filter(l => !/^\s*\|?\s*[-:]+[-| :]*\|?\s*$/.test(l));
    if (nonSep.length === 0) return;

    const parseCells = (l: string) => {
      let trimmed = l.trim();
      if (trimmed.startsWith('|')) trimmed = trimmed.substring(1);
      if (trimmed.endsWith('|')) trimmed = trimmed.substring(0, trimmed.length - 1);
      return trimmed.split('|').map(c => c.trim());
    };

    const header = parseCells(nonSep[0]);
    const rows = nonSep.slice(1).map(parseCells);

    const blocks: string[] = [];
    if (rows.length === 0) {
      blocks.push(header.map(c => `• ${c}`).join('\n'));
    } else {
      rows.forEach((row, idx) => {
        const title = row[0] || `Item ${idx + 1}`;
        const items: string[] = [];
        for (let i = 1; i < Math.max(header.length, row.length); i++) {
          const col = header[i] || '';
          const val = row[i] || '';
          if (val) {
            if (col) {
              items.push(`• *${col}*: ${val}`);
            } else {
              items.push(`• ${val}`);
            }
          }
        }
        if (items.length > 0) {
          blocks.push(`*${title}*\n${items.join('\n')}`);
        } else {
          blocks.push(`• *${title}*`);
        }
      });
    }

    resultLines.push('', blocks.join('\n\n'), '');
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isTable = /^\s*\|.*\|\s*$/.test(line);
    if (isTable) {
      tableLines.push(line);
      inTable = true;
    } else {
      if (inTable) {
        flushTable(tableLines);
        tableLines = [];
        inTable = false;
      }
      resultLines.push(line);
    }
  }
  if (inTable && tableLines.length > 0) {
    flushTable(tableLines);
  }

  return resultLines.join('\n').replace(/\n{3,}/g, '\n\n');
}

/**
 * Strips robotic repetitive introductions like:
 * "I am Riya from Lala Builders." or "This is Riya from Lala Builders."
 * when communicating in an ongoing WhatsApp chat.
 */
export function sanitizeHumanWhatsAppReply(
  text: string,
  options?: {
    isOngoingChat?: boolean;
    agentName?: string;
    companyName?: string;
    userAskedIdentity?: boolean;
  }
): string {
  let cleaned = text.trim();

  // 1. Convert markdown tables if any exist
  cleaned = convertMarkdownTablesToWhatsApp(cleaned);

  // 2. Strip robotic placeholder brackets if any leaked through
  cleaned = cleaned.replace(/\[(?:Your Name|Agent Name|My Name|Sender Name|Company|Your Company|Product|Link|Price|Name)\]/gi, '');

  // 3. Strip repetitive introductions like "I'm Riya from Lala Builders" in ongoing chats
  if ((options?.isOngoingChat || !options?.userAskedIdentity) && !/who (are you|is this)|koun ho/i.test(cleaned)) {
    const name = (options?.agentName || 'Riya').trim();
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Pattern 1: Direct intro at start: "I am Riya from Lala Builders.", "I'm Riya from..."
    const directIntro = new RegExp('^(?:I am|I[’\']m|This is|My name is)\\s+' + escapedName + '(?:\\s+(?:from|at|with)\\s+[^.,!\\n]+)?[.,!:]*\\s*', 'i');
    if (directIntro.test(cleaned)) {
      const candidate = cleaned.replace(directIntro, '').trim();
      if (candidate.length > 3) {
        cleaned = candidate.charAt(0).toUpperCase() + candidate.slice(1);
      }
    }

    // Pattern 2: Greeting with intro: "Hi Rahul! 👋 I’m Riya from Lala Builders. How can I help..." -> "Hi Rahul! 👋 How can I help..."
    const greetingWithIntro = new RegExp('^((?:Hi|Hey|Hello|Good [a-z]+)[^.!?\\n]*[.!?]*\\s*(?:[\\p{Emoji}\\u200d\\uFE0F\\s]*))(?:I am|I[’\']m|This is|My name is)\\s+' + escapedName + '(?:\\s+(?:from|at|with)\\s+[^.,!\\n]+)?[.,!:]*\\s*', 'iu');
    if (greetingWithIntro.test(cleaned)) {
      const candidate = cleaned.replace(greetingWithIntro, '$1').trim();
      if (candidate.length > 5) {
        cleaned = candidate;
      }
    }

    // Pattern 3: Mid-greeting: "Hi My, this is Riya from Lala Builders 😊. I wanted to confirm..."
    const midGreetingIntro = new RegExp('(?:this is|I am|I[’\']m)\\s+' + escapedName + '(?:\\s+(?:from|at|with)\\s+[^.,!\\n😊👋]+)?[.,!:]*\\s*[😊👋]*\\s*', 'i');
    if (midGreetingIntro.test(cleaned)) {
      const candidate = cleaned.replace(midGreetingIntro, '').replace(/^[\\s,.-]+/, '').trim();
      if (candidate.length > 5) {
        cleaned = candidate.charAt(0).toUpperCase() + candidate.slice(1);
      }
    }
  }

  return cleaned.trim();
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

  const agentName = (settings.agentName && settings.agentName.trim()) || 'Riya';
  const companyName = (settings.companyName && settings.companyName.trim()) || 'Autozonex';

  const isOngoingChat = Boolean(history && history.length > 0);
  const userAskedIdentity = /who (are you|is this)|koun ho|aap koun|what is your name/i.test(incomingMessage);

  const personaContext = `You are ${agentName}, representing ${companyName} on WhatsApp.

CRITICAL HUMAN CONVERSATION & WHATSAPP FORMATTING RULES:
1. CHAT LIKE A REAL HUMAN ON WHATSAPP:
   - Talk naturally, warmly, casually, and directly — exactly like an authentic human team member chatting on WhatsApp.
   - NEVER sound like a robotic IVR, bot, or corporate automated answering script.
   - If the user writes in Hindi, English, or Hinglish, respond naturally in their language.
   - Answer the user's specific inquiry directly and clearly without corporate fluff.

2. NEVER REPEATEDLY INTRODUCE YOURSELF:
   - DO NOT start messages with "I am ${agentName} from ${companyName}" or "This is ${agentName} from ${companyName}".
   ${isOngoingChat 
     ? '- THIS IS AN ONGOING CONVERSATION: The customer already knows who you are! DO NOT introduce yourself or your company name. Dive straight into answering their question or continuing the chat.' 
     : '- For a fresh greeting, a simple natural "Hey there! How can I help you today?" or "Hello! What can I help you with?" is much better than a robotic formulaic introduction.'}
   - Only state your name or company if the user specifically asks "Who are you?" or "Where are you from?".

3. ABSOLUTELY NO MARKDOWN TABLES:
   - NEVER generate markdown tables (do NOT use '| Col 1 | Col 2 |' or '|---|---|').
   - WhatsApp CANNOT render markdown tables. On mobile screens, tables break into messy, unreadable pipe characters.
   - ALWAYS format lists of properties, products, features, options, or pricing using clean WhatsApp bullet points (•) and bold titles (*title*), separated by neat line breaks.
   Example of proper WhatsApp formatting:
   *Kanakpura Road Plot*
   • Size: 150 sq.yd
   • Price: ₹70L
   • Facing: East
   • USP: High appreciation area

4. CRISP AND MOBILE-FRIENDLY:
   - Keep messages short (1 to 3 short paragraphs max) so they fit nicely on mobile screens.
   - Never output bracketed placeholders like [Your Name], [Company], [Price], etc.
\n`;

  const systemPrompt = personaContext + settings.systemPrompt + kbContext;
  const primaryProvider = settings.provider;
  let primaryModel = settings.model;
  let primaryApiKey = settings.apiKey || process.env.AI_API_KEY || '';

  if (!primaryModel || (primaryProvider === 'groq' && (primaryModel.includes('llama') || primaryModel === 'qwen/qwen3.6-27b'))) {
    primaryModel = primaryProvider === 'groq' ? 'openai/gpt-oss-120b' : 'meta-llama/llama-3.3-70b-instruct';
  }

  console.log(`[AI Service] Attempting response generation using ${primaryProvider} (${primaryModel})...`);

  try {
    let rawResponse = '';
    if (primaryProvider === 'groq') {
      if (!primaryApiKey) {
        throw new Error('Groq API Key is not configured.');
      }
      rawResponse = await fetchCompletions(
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
      rawResponse = await fetchCompletions(
        'https://openrouter.ai/api/v1/chat/completions',
        primaryApiKey,
        primaryModel,
        systemPrompt,
        history,
        incomingMessage
      );
    }

    return sanitizeHumanWhatsAppReply(rawResponse, {
      isOngoingChat,
      agentName,
      companyName,
      userAskedIdentity,
    });
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
        const fallbackResponse = await fetchCompletions(
          'https://openrouter.ai/api/v1/chat/completions',
          fallbackApiKey,
          fallbackModel,
          systemPrompt,
          history,
          incomingMessage
        );
        return sanitizeHumanWhatsAppReply(fallbackResponse, {
          isOngoingChat,
          agentName,
          companyName,
          userAskedIdentity,
        });
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
    ? `${settings.systemPrompt}\n\nINSTRUCTION: Suggest a natural, human next message to the customer on WhatsApp. Act like a real person chatting. Do NOT repeatedly introduce yourself. NEVER use markdown tables (| Col | Col |); use clean bullet points (•) and bold titles (*title*) instead. Keep it ready-to-send without quotes or code blocks.` 
    : 'You are a customer service representative chatting on WhatsApp. Suggest a suitable next reply. Act like a real human. Do not repeatedly introduce yourself. NEVER use markdown tables; use clean bullet points (•) instead. Do not include quotes or meta text.';

  const systemPrompt = basePrompt + kbContext;
  
  const provider = settings?.provider || 'groq';
  let model = settings?.model || (provider === 'groq' ? 'openai/gpt-oss-120b' : 'meta-llama/llama-3.3-70b-instruct');
  if (!model || (provider === 'groq' && (model.includes('llama') || model === 'qwen/qwen3.6-27b'))) {
    model = provider === 'groq' ? 'openai/gpt-oss-120b' : 'meta-llama/llama-3.3-70b-instruct';
  }
  const apiKey = settings?.apiKey || process.env.AI_API_KEY || '';
  const url = provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';

  const rawReply = await fetchCompletions(url, apiKey, model, systemPrompt, history);
  return sanitizeHumanWhatsAppReply(rawReply, {
    isOngoingChat: history.length > 0,
    agentName: settings?.agentName || 'Riya',
    companyName: settings?.companyName || 'Autozonex',
  });
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

/**
 * Transcribe WhatsApp voice notes or audio recordings using Groq Whisper (whisper-large-v3).
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType = 'audio/ogg',
  organizationId?: string
): Promise<string> {
  try {
    let apiKey = process.env.AI_API_KEY || '';
    if (organizationId) {
      const [settings] = await db
        .select()
        .from(aiSettings)
        .where(eq(aiSettings.organizationId, organizationId))
        .limit(1);
      if (settings?.apiKey) {
        apiKey = settings.apiKey;
      }
    }

    if (!apiKey) {
      console.warn('[AI Service] No API key available for audio transcription');
      return '';
    }

    const ext = mimeType.includes('mp4') || mimeType.includes('m4a') ? 'm4a'
      : mimeType.includes('mpeg') || mimeType.includes('mp3') ? 'mp3'
      : mimeType.includes('wav') ? 'wav'
      : 'ogg';

    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const headerPart = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="model"\r\n\r\n` +
      `whisper-large-v3\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="voice_note.${ext}"\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`
    );
    const footerPart = Buffer.from(`\r\n--${boundary}--\r\n`);
    const fullBody = Buffer.concat([headerPart, audioBuffer, footerPart]);

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: fullBody,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[AI Service] Groq Whisper failed (${res.status}): ${errText}`);
      return '';
    }

    const data = await res.json();
    const text = (data.text || '').trim();
    console.log(`[AI Service] 🎙️ Audio transcribed successfully (${text.length} chars): "${text}"`);
    return text;
  } catch (err: any) {
    console.error('[AI Service] Audio transcription error:', err.message);
    return '';
  }
}

