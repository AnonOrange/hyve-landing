// HYVE Attend event risk scoring — the spec §26 event-risk inputs as a pure
// function. Each observable signal contributes points; the total (capped at
// 100) maps to a band that informs the admin reviewer and the payout hold.
// §26 signals that need data HYVE does not collect (suspicious traffic,
// famous-artist claims, AI likeness) are out of scope.

export interface EventRiskInput {
  /** Events the creator has run before this one. */
  priorEventCount: number
  /** The highest ticket price on this event, in cents. */
  maxTicketPriceCents: number
  /** A stream test has passed for this event. */
  streamTested: boolean
  /** The creator's Connect account can receive payouts. */
  payoutVerified: boolean
  /** Card disputes recorded across the creator's events. */
  priorDisputeCount: number
  /** Refund requests recorded across the creator's events. */
  priorRefundCount: number
  /** Hours between the event being listed and its start time. */
  hoursListedToStart: number
}

export type RiskBand = 'LOW' | 'MEDIUM' | 'HIGH'

export interface RiskAssessment {
  score: number
  band: RiskBand
  factors: Record<string, number>
}

/** Score an event's risk from its observable signals (spec §26). */
export function scoreEvent(i: EventRiskInput): RiskAssessment {
  const factors: Record<string, number> = {}

  if (i.priorEventCount === 0) factors.newOrganizer = 20
  if (i.maxTicketPriceCents > 15000) factors.highTicketPrice = 15
  if (!i.streamTested) factors.noStreamTest = 20
  if (!i.payoutVerified) factors.payoutNotVerified = 15
  if (i.priorDisputeCount > 0) {
    factors.priorDisputes = Math.min(25, i.priorDisputeCount * 12)
  }
  if (i.priorRefundCount > 2) {
    factors.manyRefunds = Math.min(15, (i.priorRefundCount - 2) * 5)
  }
  if (i.hoursListedToStart >= 0 && i.hoursListedToStart < 48) factors.shortNotice = 10

  const score = Math.min(
    100,
    Object.values(factors).reduce((sum, v) => sum + v, 0),
  )
  const band: RiskBand = score >= 60 ? 'HIGH' : score >= 30 ? 'MEDIUM' : 'LOW'
  return { score, band, factors }
}
