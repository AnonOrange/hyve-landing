// HYVE Attend refund evidence — assembles the §17 evidence packet for one
// refund request: a rich JSON payload (stored on attend_evidence_packets) plus
// the boolean flags the §31 recommendation rules consume.
import type { RefundEvidence } from '@/lib/attend/refunds/recommendation'
import {
  getTicketEvidenceBundle,
  type TicketEvidenceBundle,
} from '@/lib/attend/refunds/refund-repository'

// Event statuses that mean the show is over.
const ENDED_STATUSES = ['ENDED', 'SETTLEMENT_HOLD', 'SETTLED', 'REFUNDING', 'ARCHIVED']
// Ticket states that mean the holder reached the room.
const ATTENDED_STATES = ['CHECKED_IN', 'IN_ROOM', 'USED']

export interface RefundEvidenceResult {
  flags: RefundEvidence
  payload: Record<string, unknown>
}

/** Fetch the evidence bundle for a ticket and derive its packet + flags. */
export async function buildRefundEvidence(ticketId: string): Promise<RefundEvidenceResult> {
  const bundle = await getTicketEvidenceBundle(ticketId)
  if (!bundle) throw new Error(`refund evidence: ticket ${ticketId} not found`)
  return deriveRefundEvidence(bundle)
}

/** Pure: an evidence bundle -> the §17 payload and the §31 recommendation flags. */
export function deriveRefundEvidence(b: TicketEvidenceBundle): RefundEvidenceResult {
  const event = b.attend_events
  const stream = event.attend_streams[0] ?? null
  const sessions = b.attend_attendance_sessions ?? []
  const watchSeconds = sessions.reduce((n, s) => n + (s.watch_seconds ?? 0), 0)

  const eventEnded = ENDED_STATUSES.includes(event.status)
  const attended =
    sessions.length > 0 ||
    watchSeconds > 0 ||
    b.checked_in_at != null ||
    ATTENDED_STATES.includes(b.state)
  const wasTransferred =
    b.state === 'TRANSFER_ACCEPTED' ||
    b.attend_ticket_transfers.some((t) => t.status === 'ACCEPTED')

  const flags: RefundEvidence = {
    eventCancelled: event.status === 'CANCELLED',
    artistNoShow: eventEnded && stream != null && stream.started_at == null,
    // No automated duplicate-charge / outage detector in the MVP; a reviewer
    // sets these from the evidence. Wired so the §31 rules stay complete.
    duplicateCharge: false,
    platformOutage: false,
    attended,
    eventEnded,
    wasTransferred,
  }

  const payload: Record<string, unknown> = {
    order: {
      id: b.attend_orders.id,
      status: b.attend_orders.status,
      total_cents: b.attend_orders.total_cents,
      created_at: b.attend_orders.created_at,
      buyer_id: b.attend_orders.buyer_id,
      stripe_payment_intent_id: b.attend_orders.stripe_payment_intent_id,
    },
    ticket: { id: b.id, state: b.state, checked_in_at: b.checked_in_at },
    event: {
      id: event.id,
      title: event.title,
      status: event.status,
      starts_at: event.starts_at,
      ends_at: event.ends_at,
      refund_cutoff_hours: event.refund_cutoff_hours,
    },
    attendance: {
      session_count: sessions.length,
      total_watch_seconds: watchSeconds,
      sessions,
    },
    transfers: b.attend_ticket_transfers,
    stream,
    policy_snapshot: b.attend_orders.policy_snapshot,
    evidence_flags: flags,
    generated_at: new Date().toISOString(),
  }

  return { flags, payload }
}
