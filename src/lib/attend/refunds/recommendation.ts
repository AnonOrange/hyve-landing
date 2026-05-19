// HYVE Attend refund recommendation — the spec §17 / §31 eligibility rules as
// one pure function. It only ever *recommends*: spec §17 is explicit that no
// refund is auto-approved, so a reviewer always makes the final call. The
// output is advisory, surfaced alongside the evidence packet.

export type RefundRecommendation = 'APPROVE' | 'DENY' | 'NEEDS_HUMAN'

export interface RefundEvidence {
  /** The event was cancelled before it took place. */
  eventCancelled: boolean
  /** The show is over and the stream never went live. */
  artistNoShow: boolean
  /** The buyer was charged more than once for the same seat. */
  duplicateCharge: boolean
  /** A global outage or platform-wide stream failure affected the event. */
  platformOutage: boolean
  /** The holder checked in, entered the room, or watched any of the show. */
  attended: boolean
  /** The event has already finished. */
  eventEnded: boolean
  /** The ticket has been transferred to and accepted by another account. */
  wasTransferred: boolean
}

/**
 * Recommend an outcome for a refund request from its evidence flags.
 *  - APPROVE      — the buyer clearly could not get what they paid for.
 *  - DENY         — the buyer attended, or missed a show that ran normally.
 *  - NEEDS_HUMAN  — ambiguous; a reviewer must weigh it (the default).
 */
export function recommendRefund(e: RefundEvidence): RefundRecommendation {
  // Clear platform-fault / billing-error cases: the buyer is owed a refund.
  if (e.eventCancelled || e.artistNoShow || e.duplicateCharge) return 'APPROVE'

  // An outage is never auto-decided — its scope is a human judgement (§31).
  if (e.platformOutage) return 'NEEDS_HUMAN'

  // A transferred ticket means the payer and the current holder differ; §31's
  // transfer rules are nuanced, so a reviewer always weighs these by hand.
  if (e.wasTransferred) return 'NEEDS_HUMAN'

  // The buyer received the show: attended it, or missed one that ran normally.
  if (e.attended) return 'DENY'
  if (e.eventEnded) return 'DENY'

  // Upcoming event, or anything the rules above do not settle.
  return 'NEEDS_HUMAN'
}
