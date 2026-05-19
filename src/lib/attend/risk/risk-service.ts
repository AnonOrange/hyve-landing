// HYVE Attend risk — assess an event's §26 risk. `evaluateEventRisk` gathers
// the observable signals and scores them (no write — safe on a page render);
// `assessAndRecordEventRisk` also persists the score and is reserved for a
// genuine decision point (settlement).
import { scoreEvent, type RiskAssessment } from '@/lib/attend/risk/risk-scoring'
import { gatherEventRiskInput, recordEventRisk } from '@/lib/attend/risk/risk-repository'

export type { RiskAssessment }

// The assessment used when an event's signals cannot be gathered — treated as
// low risk so a data gap never blocks a reviewer or extends a hold.
const UNKNOWN: RiskAssessment = { score: 0, band: 'LOW', factors: {} }

/**
 * Evaluate one event's risk: gather its §26 signals and score them. No write,
 * so this is safe to call on every render of the admin queue. A gather failure
 * degrades to LOW rather than throwing — risk is advisory, and a missing score
 * must not break the admin queue or settlement.
 */
export async function evaluateEventRisk(eventId: string): Promise<RiskAssessment> {
  try {
    const input = await gatherEventRiskInput(eventId)
    if (!input) return UNKNOWN
    return scoreEvent(input)
  } catch (err) {
    console.error(`[risk] evaluation failed for ${eventId}:`, (err as Error).message)
    return UNKNOWN
  }
}

/**
 * Evaluate an event's risk and persist the score to attend_risk_scores. Used
 * at a genuine decision point (settlement) — one row per event, not per render.
 */
export async function assessAndRecordEventRisk(eventId: string): Promise<RiskAssessment> {
  const assessment = await evaluateEventRisk(eventId)
  try {
    await recordEventRisk(eventId, assessment)
  } catch (err) {
    console.error(`[risk] record failed for ${eventId}:`, (err as Error).message)
  }
  return assessment
}
