import { LeadMemoryContext, LeadProfileAnalysis, FollowupStrategyDecision, CopywriterMessageDraft } from '../types';
import { sanitizeHumanWhatsAppReply } from '@/features/ai/lib/ai-service';

export async function runCopywriterAgent(
  context: LeadMemoryContext,
  profile: LeadProfileAnalysis,
  strategy: FollowupStrategyDecision,
  callLlm: (prompt: string, systemPrompt: string) => Promise<string>
): Promise<CopywriterMessageDraft> {
  const notesText = context.humanNotes.length > 0
    ? context.humanNotes.slice(0, 3).map(n => `- ${n.content}`).join('\n')
    : 'None';

  const agentName = context.agentName || 'Riya';
  const companyName = context.companyName || 'Autozonex';
  const greetingName = context.greetingName || 'there';

  const systemPrompt = `You are ${agentName}, a genuine and helpful team member at ${companyName}.
Your task is to write a warm, human, high-converting WhatsApp message to a lead or customer.

CRITICAL HUMAN CONVERSATION RULES:
1. CHAT LIKE A REAL HUMAN ON WHATSAPP:
   - Speak naturally, warmly, and casually — exactly like a real person messaging on WhatsApp.
   - DO NOT start messages with a robotic introduction like "This is ${agentName} from ${companyName}" or "I am ${agentName} from ${companyName}".
   - Jump directly to previous discussion points, notes, or specific customer needs (e.g. "Hi ${greetingName}, hope you're having a good week! Just wanted to follow up on the options we discussed...").
   - Only mention your name if signing off naturally at the end (e.g. "- ${agentName}"), or omit it if you are already in an active discussion.
2. ABSOLUTELY NO MARKDOWN TABLES:
   - NEVER use '| Col 1 | Col 2 |' tables. WhatsApp cannot render tables. Use clean bullet points (•) and bold titles (*title*) instead.
3. Greet the recipient naturally as "${greetingName}". (e.g. "Hi ${greetingName}," or "Hey ${greetingName},").
4. Keep the message concise (2-4 sentences max), conversational, and formatted for WhatsApp (emojis used sparingly and naturally).
5. Ground your message in the lead's specific discussion points, needs, or past notes.
6. End with a simple, low-friction question or call to action (e.g. "Would you have 5 mins for a quick call tomorrow?", "Let me know if you would like me to share more details!").
7. NEVER output placeholders or brackets like [Your Name], [Your Company], [Company], [Product], [key benefit], [desired outcome], [Name], etc.
8. Return ONLY a valid JSON object.`;

  const knowledgeSection = context.relevantKnowledgeContext
    ? `\nCompany Knowledge Base & Offerings:\n${context.relevantKnowledgeContext}\n`
    : '';

  const userPrompt = `Sender & Branding Info:
- Your Name (Sales Rep / AI Persona): ${agentName}
- Your Company: ${companyName}

Recipient Context:
- Greeting Name to use: ${greetingName}
- Clean Full Name: ${context.cleanContactName}
- Lead Score: ${profile.leadScore}/100
- Buying Intent: ${profile.buyingIntent}
- Primary Need: ${profile.need || 'Not specified'}
- Pain Points: ${profile.painPoints.join(', ') || 'N/A'}
- Objections to address gently: ${profile.objections.join(', ') || 'N/A'}
- Relevant Human Sales Notes: ${notesText}
- Deal Inactivity Status: ${context.isStagnant ? `Deal has been inactive for ${context.daysInactive} days. Write a natural, friendly, zero-pressure re-engagement hook or helpful update.` : 'Active conversation'}
${knowledgeSection}
Follow-up Objective:
${strategy.communicationGoal}

Strategic Reason:
${strategy.strategyReason}

WRITE THE COMPLETED, READY-TO-SEND WHATSAPP MESSAGE (NO PLACEHOLDERS, STRICT JSON):
{
  "messageText": "The completed WhatsApp message starting with greeting to ${greetingName}",
  "tone": "consultative" | "friendly" | "urgent" | "empathetic" | "professional",
  "referencesHumanNotes": true | false,
  "rationale": "Reason for this messaging angle"
}`;

  try {
    const rawRes = await callLlm(userPrompt, systemPrompt);
    let cleanJson = rawRes.trim();
    if (cleanJson.includes('```json')) {
      cleanJson = cleanJson.split('```json')[1].split('```')[0].trim();
    } else if (cleanJson.includes('```')) {
      cleanJson = cleanJson.split('```')[1].split('```')[0].trim();
    }
    const parsed = JSON.parse(cleanJson);

    let messageText = parsed.messageText || `Hi ${greetingName}, hope you're having a great day! Just checking in to see if you had any questions regarding our discussion or if I can help with anything.`;

    // Fail-safe post-processing replacement for any rogue placeholder brackets, tables, and repetitive intros
    messageText = sanitizePlaceholders(messageText, agentName, companyName, greetingName);
    messageText = sanitizeHumanWhatsAppReply(messageText, { isOngoingChat: true, agentName, companyName });

    return {
      messageText,
      tone: parsed.tone || 'friendly',
      referencesHumanNotes: Boolean(parsed.referencesHumanNotes),
      rationale: parsed.rationale || 'Personalized conversational follow-up.',
    };
  } catch (err) {
    console.error('[CopywriterAgent] Parsing error:', err);
    const fallbackMsg = `Hi ${greetingName}, hope you're having a great week! Just wanted to check in and see how things are going with your requirements. Let me know if you have any questions!`;
    return {
      messageText: fallbackMsg,
      tone: 'friendly',
      referencesHumanNotes: false,
      rationale: 'Fallback friendly conversational greeting draft.',
    };
  }
}

function sanitizePlaceholders(text: string, agentName: string, companyName: string, greetingName: string): string {
  let cleaned = text;
  cleaned = cleaned.replace(/\[(?:Your Name|Agent Name|My Name|Sender Name|Representative)\]/gi, agentName);
  cleaned = cleaned.replace(/\[(?:Your Company|Company Name|Our Company|Business Name|Organization)\]/gi, companyName);
  cleaned = cleaned.replace(/\[(?:Client Name|Customer Name|Recipient Name|Lead Name|Name)\]/gi, greetingName);
  cleaned = cleaned.replace(/\[(?:key benefit|desired outcome|benefit|outcome)\]/gi, 'growth and efficiency');
  return cleaned;
}
