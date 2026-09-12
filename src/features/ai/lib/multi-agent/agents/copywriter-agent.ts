import { LeadMemoryContext, LeadProfileAnalysis, FollowupStrategyDecision, CopywriterMessageDraft } from '../types';

export async function runCopywriterAgent(
  context: LeadMemoryContext,
  profile: LeadProfileAnalysis,
  strategy: FollowupStrategyDecision,
  callLlm: (prompt: string, systemPrompt: string) => Promise<string>
): Promise<CopywriterMessageDraft> {
  const notesText = context.humanNotes.length > 0
    ? context.humanNotes.slice(0, 3).map(n => `- ${n.content}`).join('\n')
    : 'None';

  const systemPrompt = `You are an elite B2B/B2C WhatsApp Sales Copywriter.
Your goal is to write a human-sounding, concise, high-converting WhatsApp message tailored to the client's profile, pain points, and human notes.
Rules:
- Keep it under 3-4 sentences. WhatsApp messages should feel natural, conversational, and direct.
- DO NOT sound like a robotic AI marketing email.
- Reference context naturally if applicable (e.g. their specific pain point or discussion topic).
- Include a low-friction call to action (e.g., "Would you have 5 mins tomorrow?", "Let me know if this sounds like a good fit!").
Return ONLY a valid JSON object.`;

  const knowledgeSection = context.relevantKnowledgeContext
    ? `\nCompany Knowledge Base & FAQs (Use these accurate details if relevant):\n${context.relevantKnowledgeContext}\n`
    : '';

  const userPrompt = `Client Context:
- Name: ${context.contactName}
- Lead Score: ${profile.leadScore}/100
- Buying Intent: ${profile.buyingIntent}
- Primary Need: ${profile.need || 'Not specified'}
- Pain Points: ${profile.painPoints.join(', ') || 'N/A'}
- Objections to address gently: ${profile.objections.join(', ') || 'N/A'}
- Relevant Human Notes: ${notesText}
${knowledgeSection}
Follow-up Goal:
${strategy.communicationGoal}

Reason for Follow-up:
${strategy.strategyReason}

WRITE THE WHATSAPP MESSAGE (RETURN STRICT JSON):
{
  "messageText": "The exact message to send to the client on WhatsApp",
  "tone": "consultative" or "friendly" or "urgent" or "empathetic" or "professional",
  "referencesHumanNotes": true or false,
  "rationale": "Why this message framing was chosen"
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
    return {
      messageText: parsed.messageText || `Hi ${context.contactName}, hope you're having a great day! Just checking in to see if you had any questions regarding our discussion.`,
      tone: parsed.tone || 'friendly',
      referencesHumanNotes: Boolean(parsed.referencesHumanNotes),
      rationale: parsed.rationale || 'Personalized conversational follow-up.',
    };
  } catch (err) {
    console.error('[CopywriterAgent] Parsing error:', err);
    return {
      messageText: `Hi ${context.contactName}, hope you are doing well! Let me know if you would like to explore how we can help with your requirements.`,
      tone: 'friendly',
      referencesHumanNotes: false,
      rationale: 'Fallback greeting draft.',
    };
  }
}
