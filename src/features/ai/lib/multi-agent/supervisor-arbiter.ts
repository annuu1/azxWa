import { 
  LeadMemoryContext, 
  LeadProfileAnalysis, 
  FollowupStrategyDecision, 
  CopywriterMessageDraft, 
  SupervisorArbiterResult, 
  AiExecutionMode 
} from './types';

export function runSupervisorArbiter(
  context: LeadMemoryContext,
  profile: LeadProfileAnalysis,
  strategy: FollowupStrategyDecision,
  messageDraft: CopywriterMessageDraft | null,
  aiMode: AiExecutionMode = 'APPROVAL_REQUIRED'
): SupervisorArbiterResult {
  // 1. Calculate weighted overall confidence
  const overallConfidence = Number(((profile.confidence * 0.5) + (strategy.confidence * 0.5)).toFixed(2));

  // 2. Evaluate Human Escalation Guardrails
  let shouldEscalateToHuman = false;
  let escalationReason: string | undefined = undefined;

  if (profile.sentiment === 'FRUSTRATED' || profile.sentiment === 'COLD') {
    shouldEscalateToHuman = true;
    escalationReason = `Negative or frustrated client sentiment detected (${profile.sentiment}). Human review recommended.`;
  } else if (overallConfidence < 0.70) {
    shouldEscalateToHuman = true;
    escalationReason = `AI decision confidence is below threshold (${overallConfidence} < 0.70). Human review required.`;
  } else if (profile.conversationState === 'HUMAN_ESCALATED') {
    shouldEscalateToHuman = true;
    escalationReason = 'Lead explicitly marked for human intervention.';
  }

  // 3. Resolve recommended pipeline stage
  let recommendedStageId: string | undefined = undefined;
  if (profile.recommendedStageName) {
    const matched = context.pipelineStages.find(
      s => s.name.toLowerCase() === profile.recommendedStageName?.toLowerCase()
    );
    if (matched) recommendedStageId = matched.id;
  }

  // 4. Formulate Primary Action Proposal
  let actionType: 'FOLLOWUP_MESSAGE' | 'STAGE_TRANSITION' | 'TAG_UPDATE' | 'LEAD_SCORE_UPDATE' | 'ESCALATE_HUMAN' = 'FOLLOWUP_MESSAGE';
  if (shouldEscalateToHuman) {
    actionType = 'ESCALATE_HUMAN';
  } else if (recommendedStageId && recommendedStageId !== context.currentStageId) {
    actionType = 'STAGE_TRANSITION';
  }

  const executiveSummary = `${profile.summary} | Intent: ${profile.buyingIntent} | Score: ${profile.leadScore}/100 | Strategy: ${strategy.strategyReason}`;

  return {
    leadId: context.leadId,
    contactId: context.contactId,
    executiveSummary,
    profile,
    strategy,
    messageDraft: messageDraft || undefined,
    recommendedStageId,
    overallConfidence,
    shouldEscalateToHuman,
    escalationReason,
    executionMode: aiMode,
    proposedAction: {
      actionType,
      proposedPayload: {
        message: messageDraft?.messageText,
        targetStageId: recommendedStageId,
        targetStageName: profile.recommendedStageName,
        scheduledFollowupAt: strategy.suggestedFollowupDateIso,
        reason: strategy.strategyReason,
        leadScore: profile.leadScore,
        tagsToAdd: profile.buyingIntent === 'HIGH' ? ['Hot Lead'] : undefined,
      },
    },
  };
}
