import { db } from '@/shared/database';
import { aiSettings, leadIntelligence, aiActionProposals, leads, contacts, activities, tags, contactTags } from '@/shared/database/schema';
import { eq, and, desc } from 'drizzle-orm';
import { aggregateLeadMemory } from './memory-aggregator';
import { runLeadProfilerAgent } from './agents/lead-profiler-agent';
import { runFollowupStrategyAgent } from './agents/followup-strategy-agent';
import { runCopywriterAgent } from './agents/copywriter-agent';
import { runSupervisorArbiter } from './supervisor-arbiter';
import { SupervisorArbiterResult, AiExecutionMode } from './types';

// Helper to make an LLM call using organization AI settings
async function makeLlmCall(orgId: string, prompt: string, systemPrompt: string): Promise<string> {
  const [settings] = await db.select().from(aiSettings).where(eq(aiSettings.organizationId, orgId)).limit(1);
  const apiKey = settings?.apiKey || process.env.AI_API_KEY || '';
  const provider = settings?.provider || process.env.AI_PROVIDER || 'groq';
  let model = settings?.model || 'openai/gpt-oss-120b';

  let url = 'https://api.groq.com/openai/v1/chat/completions';
  if (provider === 'openrouter') {
    url = 'https://openrouter.ai/api/v1/chat/completions';
    if (!model || model.includes('llama')) model = 'anthropic/claude-3.5-haiku';
  } else {
    // Groq default
    if (!model || model.includes('llama') || model === 'qwen/qwen3.6-27b') model = 'openai/gpt-oss-120b';
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'AutoZoneX-Agent/1.0',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.6,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI Provider Error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  let content = data.choices?.[0]?.message?.content || '';
  if (content.includes('</think>')) {
    content = content.split('</think>').pop() || content;
  }
  return content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

export async function orchestrateLeadIntelligence(orgId: string, leadId: string): Promise<SupervisorArbiterResult> {
  // 1. Fetch AI Settings
  const [settings] = await db.select().from(aiSettings).where(eq(aiSettings.organizationId, orgId)).limit(1);
  const aiMode: AiExecutionMode = (settings?.aiMode as any) || 'APPROVAL_REQUIRED';

  // 2. Aggregate 3-Tier Memory
  const memoryContext = await aggregateLeadMemory(orgId, leadId);
  if (!memoryContext) throw new Error('Lead or Contact not found');

  const llmCaller = (prompt: string, sysPrompt: string) => makeLlmCall(orgId, prompt, sysPrompt);

  // 3. Agent 1: Lead Profiler & Analyst
  const profile = await runLeadProfilerAgent(memoryContext, llmCaller);

  // 4. Agent 2: Follow-up Strategy & Timing
  const strategy = await runFollowupStrategyAgent(memoryContext, profile, llmCaller);

  // 5. Agent 3: Copywriter Message Draft
  let messageDraft = null;
  if (strategy.shouldSendMessage) {
    messageDraft = await runCopywriterAgent(memoryContext, profile, strategy, llmCaller);
  }

  // 6. Supervisor Arbiter
  const arbiterResult = runSupervisorArbiter(memoryContext, profile, strategy, messageDraft, aiMode);

  // 7. Persist Lead Intelligence
  const existingIntel = await db.select().from(leadIntelligence).where(eq(leadIntelligence.leadId, leadId)).limit(1);
  const intelValues = {
    organizationId: orgId,
    leadId,
    contactId: memoryContext.contactId,
    summary: arbiterResult.profile.summary,
    buyerPersona: arbiterResult.profile.buyerPersona,
    buyingIntent: arbiterResult.profile.buyingIntent,
    leadScore: arbiterResult.profile.leadScore,
    sentiment: arbiterResult.profile.sentiment,
    budget: arbiterResult.profile.budget,
    authority: arbiterResult.profile.authority,
    need: arbiterResult.profile.need,
    timeline: arbiterResult.profile.timeline,
    painPoints: JSON.stringify(arbiterResult.profile.painPoints),
    objections: JSON.stringify(arbiterResult.profile.objections),
    preferences: arbiterResult.profile.preferences,
    recommendedStageId: arbiterResult.recommendedStageId,
    nextFollowupAt: strategy.suggestedFollowupDateIso ? new Date(strategy.suggestedFollowupDateIso) : null,
    nextFollowupReason: strategy.strategyReason,
    nextSuggestedMessage: messageDraft?.messageText,
    conversationState: arbiterResult.profile.conversationState,
    confidence: String(arbiterResult.overallConfidence),
    lastAnalyzedAt: new Date(),
    updatedAt: new Date(),
  };

  if (existingIntel.length > 0) {
    await db.update(leadIntelligence).set(intelValues).where(eq(leadIntelligence.leadId, leadId));
  } else {
    await db.insert(leadIntelligence).values(intelValues);
  }

  // 8. Create or Execute Action Proposal
  if (aiMode === 'AUTONOMOUS' && !arbiterResult.shouldEscalateToHuman && arbiterResult.overallConfidence >= 0.75) {
    // Autonomous Execution Mode
    if (arbiterResult.recommendedStageId && arbiterResult.recommendedStageId !== memoryContext.currentStageId) {
      await db.update(leads).set({ stageId: arbiterResult.recommendedStageId, updatedAt: new Date() }).where(eq(leads.id, leadId));
      await db.insert(activities).values({
        organizationId: orgId,
        contactId: memoryContext.contactId,
        type: 'LEAD_STAGE_CHANGED',
        description: `AI Autonomous Agent moved lead to stage "${arbiterResult.profile.recommendedStageName}" (Score: ${profile.leadScore})`,
      });
    }

    // Save auto-executed proposal record
    await db.insert(aiActionProposals).values({
      organizationId: orgId,
      leadId,
      contactId: memoryContext.contactId,
      actionType: arbiterResult.proposedAction.actionType,
      status: 'AUTO_EXECUTED',
      confidence: String(arbiterResult.overallConfidence),
      reasoning: arbiterResult.proposedAction.proposedPayload.reason || arbiterResult.executiveSummary,
      proposedPayload: JSON.stringify(arbiterResult.proposedAction.proposedPayload),
      executionMode: 'AUTONOMOUS',
      executedAt: new Date(),
    });
  } else {
    // Approval Required (Co-Pilot Safe Mode)
    await db.insert(aiActionProposals).values({
      organizationId: orgId,
      leadId,
      contactId: memoryContext.contactId,
      actionType: arbiterResult.proposedAction.actionType,
      status: 'PENDING_APPROVAL',
      confidence: String(arbiterResult.overallConfidence),
      reasoning: arbiterResult.proposedAction.proposedPayload.reason || arbiterResult.executiveSummary,
      proposedPayload: JSON.stringify(arbiterResult.proposedAction.proposedPayload),
      executionMode: 'APPROVAL_REQUIRED',
    });
  }

  return arbiterResult;
}
