import { LeadMemoryContext, LeadProfileAnalysis, FollowupStrategyDecision } from '../types';

export async function runFollowupStrategyAgent(
  context: LeadMemoryContext,
  profile: LeadProfileAnalysis,
  callLlm: (prompt: string, systemPrompt: string) => Promise<string>
): Promise<FollowupStrategyDecision> {
  const notesText = context.humanNotes.length > 0
    ? context.humanNotes.map(n => `- [${new Date(n.createdAt).toLocaleDateString()} by ${n.authorName}]: ${n.content}`).join('\n')
    : 'None';

  const lastMsgs = context.chatHistory.slice(-6).map(m => `${m.sender}: ${m.body}`).join('\n') || 'None';

  const systemPrompt = `You are an expert Sales Strategy & Follow-up Timing Agent.
Your job is to decide WHEN and WHY the next follow-up should occur with this client, or whether to wait.
You must carefully evaluate:
- The lead's current intent, stage, and score
- Human notes (e.g. if a human note says "Follow up next Tuesday at 3pm", RESPECT IT!)
- Recent conversation momentum (did the customer just ask a question, or are they waiting on us?)

Return ONLY a valid JSON object.`;

  const userPrompt = `Lead Profile:
- Contact Name: ${context.contactName}
- Lead Score: ${profile.leadScore}/100 (${profile.buyingIntent} intent)
- Sentiment: ${profile.sentiment}
- Conversation State: ${profile.conversationState}
- Client Summary: ${profile.summary}
- Inactivity Status: ${context.isStagnant ? `🚨 STAGNANT: Inactive for ${context.daysInactive} days in stage "${context.currentStageName}". Needs friendly, low-pressure re-engagement.` : 'Active discussion'}

Recent Human Notes:
${notesText}

Recent Messages:
${lastMsgs}

DECIDE FOLLOWUP STRATEGY (RETURN STRICT JSON):
{
  "shouldSendMessage": true or false,
  "timing": "IMMEDIATE" or "IN_FEW_HOURS" or "TOMORROW_MORNING" or "IN_2_DAYS" or "IN_1_WEEK" or "NO_FOLLOWUP",
  "hoursFromNow": <number of hours e.g. 0, 3, 24, 48, 168>,
  "strategyReason": "Detailed reason why this timing was chosen based on conversation context and notes",
  "communicationGoal": "Specific objective of the next message e.g. Share case study / Clarify budget / Offer product walkthrough",
  "confidence": 0.88
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
    const hours = typeof parsed.hoursFromNow === 'number' ? parsed.hoursFromNow : 24;
    const targetDate = new Date(Date.now() + hours * 60 * 60 * 1000);

    return {
      shouldSendMessage: Boolean(parsed.shouldSendMessage !== false),
      timing: parsed.timing || 'TOMORROW_MORNING',
      suggestedFollowupDateIso: targetDate.toISOString(),
      strategyReason: parsed.strategyReason || 'Standard sales cadence follow-up.',
      communicationGoal: parsed.communicationGoal || 'Check in with prospect and address questions.',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.85,
    };
  } catch (err) {
    console.error('[FollowupStrategyAgent] Parsing error:', err);
    return {
      shouldSendMessage: true,
      timing: 'TOMORROW_MORNING',
      suggestedFollowupDateIso: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      strategyReason: 'Follow up to maintain momentum.',
      communicationGoal: 'Check in on requirements.',
      confidence: 0.75,
    };
  }
}
