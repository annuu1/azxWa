import { LeadMemoryContext, LeadProfileAnalysis } from '../types';

export async function runLeadProfilerAgent(
  context: LeadMemoryContext,
  callLlm: (prompt: string, systemPrompt: string) => Promise<string>,
  customPrompt?: string | null
): Promise<LeadProfileAnalysis> {
  const notesText = context.humanNotes.length > 0
    ? context.humanNotes.map(n => `- [${new Date(n.createdAt).toLocaleDateString()} by ${n.authorName}]: ${n.content}`).join('\n')
    : 'No human notes added yet.';

  const chatText = context.chatHistory.length > 0
    ? context.chatHistory.slice(-15).map(m => `${m.sender}: ${m.body}`).join('\n')
    : 'No previous WhatsApp chat history.';

  const tagsText = context.assignedTags.map(t => t.name).join(', ') || 'None';
  const stagesText = context.pipelineStages.map(s => s.name).join(' -> ');

  const customCriteriaText = customPrompt && customPrompt.trim()
    ? `\nORGANIZATION CUSTOM PROFILING GUIDELINES:\n${customPrompt.trim()}\n`
    : '';

  const systemPrompt = `You are an elite Sales Intelligence & Lead Profiler Agent.
Your job is to deeply analyze a sales lead by synthesizing:
1. Human Sales Notes (CRITICAL - prioritize facts and observations recorded by human sales reps)
2. WhatsApp Chat History
3. Current Pipeline Stage and Tags
${customCriteriaText}
You must extract BANT facts (Budget, Authority, Need, Timeline), client sentiment, buying intent, pain points, objections, and calculate a realistic Lead Score (0-100).
Return ONLY a valid JSON object.`;

  const userPrompt = `Lead Details:
- Contact Name: ${context.cleanContactName} (Saved as: "${context.contactName}", Greeting: "${context.greetingName}")
- WhatsApp Number: ${context.whatsappId}
- Current Pipeline Stage: ${context.currentStageName || 'New'}
- Available Stages in Pipeline: ${stagesText}
- Assigned Tags: ${tagsText}

HUMAN NOTES (Important Observations from Sales Team):
${notesText}

RECENT WHATSAPP CHAT HISTORY:
${chatText}

KNOWLEDGE BASE CONTEXT (Products/Services):
${context.relevantKnowledgeContext || 'N/A'}

ANALYZE THIS LEAD AND RETURN STRICT JSON:
{
  "summary": "2-3 sentence executive client profile summary focusing on who they are, what they need, and their current stance",
  "buyerPersona": "Brief persona e.g. Business Decision Maker or Price-sensitive Prospect",
  "buyingIntent": "HIGH" or "MEDIUM" or "LOW" or "UNQUALIFIED",
  "leadScore": 75,
  "sentiment": "POSITIVE" or "NEUTRAL" or "CURIOUS" or "FRUSTRATED" or "COLD",
  "budget": "Extracted budget or Not stated",
  "authority": "Decision maker status or Unknown",
  "need": "Primary requirement or problem they want to solve",
  "timeline": "Purchase timeline or urgency",
  "painPoints": ["Array of 1-3 specific pain points"],
  "objections": ["Array of 0-3 potential hesitations or objections mentioned"],
  "preferences": "Communication or product preferences",
  "recommendedStageName": "Best matching stage from: ${stagesText}",
  "conversationState": "NEW" or "QUALIFYING" or "DISCOVERY" or "PROPOSAL" or "NEGOTIATION" or "CLOSED_WON" or "CLOSED_LOST" or "SUPPORT" or "HUMAN_ESCALATED",
  "confidence": 0.88,
  "reasoning": "Brief rationale for why this score and stage were chosen"
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
      summary: parsed.summary || 'Client is evaluating options.',
      buyerPersona: parsed.buyerPersona || 'Prospective Client',
      buyingIntent: parsed.buyingIntent || 'MEDIUM',
      leadScore: typeof parsed.leadScore === 'number' ? Math.min(100, Math.max(0, parsed.leadScore)) : 50,
      sentiment: parsed.sentiment || 'NEUTRAL',
      budget: parsed.budget,
      authority: parsed.authority,
      need: parsed.need,
      timeline: parsed.timeline,
      painPoints: Array.isArray(parsed.painPoints) ? parsed.painPoints : [],
      objections: Array.isArray(parsed.objections) ? parsed.objections : [],
      preferences: parsed.preferences,
      recommendedStageName: parsed.recommendedStageName || context.currentStageName,
      conversationState: parsed.conversationState || 'QUALIFYING',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.85,
      reasoning: parsed.reasoning || 'Analysis synthesized from chat history and human notes.',
    };
  } catch (err) {
    console.error('[LeadProfilerAgent] Parsing error:', err);
    return {
      summary: 'Active lead engaging on WhatsApp.',
      buyerPersona: 'Prospect',
      buyingIntent: 'MEDIUM',
      leadScore: 50,
      sentiment: 'NEUTRAL',
      painPoints: [],
      objections: [],
      conversationState: 'QUALIFYING',
      confidence: 0.7,
      reasoning: 'Fallback profile due to analysis parsing error.',
    };
  }
}
