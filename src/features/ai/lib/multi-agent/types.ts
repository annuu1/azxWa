export type ConversationState = 
  | 'NEW'
  | 'QUALIFYING'
  | 'DISCOVERY'
  | 'PROPOSAL'
  | 'NEGOTIATION'
  | 'CLOSED_WON'
  | 'CLOSED_LOST'
  | 'SUPPORT'
  | 'HUMAN_ESCALATED';

export type BuyingIntent = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNQUALIFIED';
export type SentimentType = 'POSITIVE' | 'NEUTRAL' | 'CURIOUS' | 'FRUSTRATED' | 'COLD';
export type AiExecutionMode = 'AUTONOMOUS' | 'APPROVAL_REQUIRED';

export interface HumanNoteContext {
  id: string;
  content: string;
  authorName?: string;
  createdAt: Date | string;
}

export interface ChatMessageContext {
  role: 'customer' | 'agent' | 'ai';
  sender?: string;
  body: string;
  timestamp?: number | string;
}

export interface LeadMemoryContext {
  leadId: string;
  contactId: string;
  contactName: string;
  cleanContactName: string;
  greetingName: string;
  agentName: string;
  companyName: string;
  whatsappId: string;
  currentStageId?: string | null;
  currentStageName?: string;
  pipelineStages: Array<{ id: string; name: string; position: number }>;
  assignedTags: Array<{ id: string; name: string; color: string }>;
  humanNotes: HumanNoteContext[];
  chatHistory: ChatMessageContext[];
  existingSummary?: string | null;
  existingState?: ConversationState | null;
  relevantKnowledgeContext?: string;
}

export interface LeadProfileAnalysis {
  summary: string;
  buyerPersona: string;
  buyingIntent: BuyingIntent;
  leadScore: number; // 0 - 100
  sentiment: SentimentType;
  budget?: string;
  authority?: string;
  need?: string;
  timeline?: string;
  painPoints: string[];
  objections: string[];
  preferences?: string;
  recommendedStageName?: string;
  conversationState: ConversationState;
  confidence: number; // 0.0 - 1.0
  reasoning: string;
}

export interface FollowupStrategyDecision {
  shouldSendMessage: boolean;
  timing: 'IMMEDIATE' | 'IN_FEW_HOURS' | 'TOMORROW_MORNING' | 'IN_2_DAYS' | 'IN_1_WEEK' | 'NO_FOLLOWUP';
  suggestedFollowupDateIso: string;
  strategyReason: string;
  communicationGoal: string;
  confidence: number;
}

export interface CopywriterMessageDraft {
  messageText: string;
  tone: 'consultative' | 'friendly' | 'urgent' | 'empathetic' | 'professional';
  referencesHumanNotes: boolean;
  rationale: string;
}

export interface SupervisorArbiterResult {
  leadId: string;
  contactId: string;
  executiveSummary: string;
  profile: LeadProfileAnalysis;
  strategy: FollowupStrategyDecision;
  messageDraft?: CopywriterMessageDraft;
  recommendedStageId?: string;
  overallConfidence: number;
  shouldEscalateToHuman: boolean;
  escalationReason?: string;
  executionMode: AiExecutionMode;
  proposedAction: {
    actionType: 'FOLLOWUP_MESSAGE' | 'STAGE_TRANSITION' | 'TAG_UPDATE' | 'LEAD_SCORE_UPDATE' | 'ESCALATE_HUMAN';
    proposedPayload: {
      message?: string;
      targetStageId?: string;
      targetStageName?: string;
      scheduledFollowupAt?: string;
      reason?: string;
      leadScore?: number;
      tagsToAdd?: string[];
    };
  };
}
