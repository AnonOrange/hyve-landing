// HYVE Attend dispute evidence — assembles the §18 evidence packet for a
// disputed order: a rich JSON payload (stored on attend_evidence_packets) plus
// the boolean flags the §18 contest/accept rules consume.
import type { DisputeEvidence } from '@/lib/attend/disputes/dispute-recommendation'
import {
  getOrderEvidenceBundle,
  type OrderEvidenceBundle,
} from '@/lib/attend/disputes/dispute-repository'

// Event statuses that mean the show is over.
const ENDED_STATUSES = ['ENDED', 'SETTLEMENT_HOLD', 'SETTLED', 'REFUNDING', 'ARCHIVED']
// Ticket states that mean the holder reached the room.
const ATTENDED_STATES = ['CHECKED_IN', 'IN_ROOM', 'USED']

export interface DisputeEvidenceResult {
  flags: DisputeEvidence
  payload: Record<string, unknown>
}

/** Fetch the order's evidence bundle and derive its packet + flags. */
export async function buildDisputeEvidence(orderId: string): Promise<DisputeEvidenceResult> {
  const bundle = await getOrderEvidenceBundle(orderId)
  if (!bundle) throw new Error(`dispute evidence: order ${orderId} not found`)
  return deriveDisputeEvidence(bundle)
}

/** Pure: an order evidence bundle -> the §18 payload and the §18 rule flags. */
export function deriveDisputeEvidence(b: OrderEvidenceBundle): DisputeEvidenceResult {
  const event = b.attend_events
  const stream = event.attend_streams[0] ?? null
  const tickets = b.attend_tickets ?? []

  const eventEnded = ENDED_STATUSES.includes(event.status)
  const anyAttended = tickets.some(
    (t) =>
      t.checked_in_at != null ||
      ATTENDED_STATES.includes(t.state) ||
      (t.attend_attendance_sessions ?? []).length > 0,
  )

  const flags: DisputeEvidence = {
    eventCancelled: event.status === 'CANCELLED',
    artistNoShow: eventEnded && stream != null && stream.started_at == null,
    anyAttended,
    eventEnded,
  }

  const payload: Record<string, unknown> = {
    order: {
      id: b.id,
      status: b.status,
      total_cents: b.total_cents,
      currency: b.currency,
      created_at: b.created_at,
      buyer_id: b.buyer_id,
      stripe_payment_intent_id: b.stripe_payment_intent_id,
    },
    event: {
      id: event.id,
      title: event.title,
      status: event.status,
      starts_at: event.starts_at,
      ends_at: event.ends_at,
    },
    stream,
    tickets: tickets.map((t) => ({
      id: t.id,
      state: t.state,
      checked_in_at: t.checked_in_at,
      attendance: t.attend_attendance_sessions ?? [],
      transfers: t.attend_ticket_transfers ?? [],
    })),
    policy_snapshot: b.policy_snapshot,
    evidence_flags: flags,
    proof_event_occurred: eventEnded,
    generated_at: new Date().toISOString(),
  }

  return { flags, payload }
}
