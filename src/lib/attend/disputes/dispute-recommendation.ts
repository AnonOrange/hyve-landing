// HYVE Attend dispute recommendation — the spec §18 contest/accept rules as a
// pure function, plus a deadline check. Advisory only: a reviewer always makes
// the final call (a dispute carries a hard card-network deadline, so the
// recommendation exists to help them triage, not to act on its own).

export type DisputeResponse = 'CONTEST' | 'ACCEPT' | 'NEEDS_HUMAN'

export interface DisputeEvidence {
  /** The event was cancelled — the buyer was owed their money. */
  eventCancelled: boolean
  /** The show is over and the stream never went live. */
  artistNoShow: boolean
  /** At least one ticket on the order was checked in / watched. */
  anyAttended: boolean
  /** The event has already finished. */
  eventEnded: boolean
}

// A dispute is "due soon" within this window of its card-network deadline.
const DUE_SOON_MS = 48 * 60 * 60 * 1000

/**
 * Recommend a response to a card dispute from its evidence.
 *  - CONTEST     — the buyer received the show; we have a case worth fighting.
 *  - ACCEPT      — the event failed to happen; contesting would only lose.
 *  - NEEDS_HUMAN — ambiguous; a reviewer must weigh it (the default).
 */
export function recommendDisputeResponse(e: DisputeEvidence): DisputeResponse {
  // The event did not deliver — there is no evidence to win on.
  if (e.eventCancelled || e.artistNoShow) return 'ACCEPT'

  // The buyer attended, or the event ran normally and they simply did not.
  if (e.anyAttended) return 'CONTEST'
  if (e.eventEnded) return 'CONTEST'

  // Upcoming event, or anything the rules above do not settle.
  return 'NEEDS_HUMAN'
}

/** True when the dispute's card-network deadline is within 48 hours (or past). */
export function isDisputeDueSoon(dueBy: string | null, now: Date = new Date()): boolean {
  if (!dueBy) return false
  return new Date(dueBy).getTime() - now.getTime() <= DUE_SOON_MS
}
