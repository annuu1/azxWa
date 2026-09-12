import { orchestrateLeadIntelligence } from './multi-agent-orchestrator';

// Store debounce timers globally so hot reloads or multiple imports share the timer map
const globalRef = globalThis as any;
if (!globalRef.leadAnalysisQueueTimers) {
  globalRef.leadAnalysisQueueTimers = new Map<string, NodeJS.Timeout>();
}

const timers: Map<string, NodeJS.Timeout> = globalRef.leadAnalysisQueueTimers;

/**
 * Queue a lead for background multi-agent AI analysis with debouncing.
 * If the lead receives multiple messages within the delay window (default 25s),
 * the previous timer is cancelled and reset so the AI analyzes the complete burst.
 *
 * @param orgId Organization ID
 * @param leadId Lead ID to profile
 * @param delayMs Debounce delay in milliseconds (default 25,000ms = 25s)
 */
export function queueLeadAnalysis(orgId: string, leadId: string, delayMs = 25000): void {
  if (!orgId || !leadId) return;

  const key = `${orgId}:${leadId}`;

  // Clear existing timer if message burst is ongoing
  if (timers.has(key)) {
    clearTimeout(timers.get(key)!);
    timers.delete(key);
  }

  const timer = setTimeout(async () => {
    timers.delete(key);
    console.log(`[LeadAnalysisQueue] 🧠 Initiating autonomous multi-agent analysis for lead ${leadId}...`);
    try {
      const result = await orchestrateLeadIntelligence(orgId, leadId);
      console.log(`[LeadAnalysisQueue] ✅ Autonomous analysis complete for lead ${leadId}: Score ${result.profile.leadScore}/100, Intent: ${result.profile.buyingIntent}, Sentiment: ${result.profile.sentiment}`);
    } catch (err: any) {
      console.error(`[LeadAnalysisQueue] ❌ Error analyzing lead ${leadId}:`, err.message);
    }
  }, delayMs);

  timers.set(key, timer);
  console.log(`[LeadAnalysisQueue] ⏳ Scheduled background lead analysis for lead ${leadId} in ${delayMs / 1000}s`);
}

/**
 * Cancel a pending lead analysis
 */
export function cancelPendingLeadAnalysis(orgId: string, leadId: string): void {
  const key = `${orgId}:${leadId}`;
  if (timers.has(key)) {
    clearTimeout(timers.get(key)!);
    timers.delete(key);
  }
}
