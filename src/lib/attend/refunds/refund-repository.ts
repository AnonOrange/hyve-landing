// Raw-REST data access for the HYVE Attend refund tables. Query-only — no
// business logic. Server-side only (service-key reads).
import { supaGet, supaPost, supaPatch } from '@/lib/supabase'

export interface RefundRequestRow {
  id: string
  ticket_id: string
  order_id: string
  event_id: string
  requester_id: string
  reason: string | null
  status: string
  recommendation: string | null
  evidence_packet_id: string | null
  amount_cents: number | null
  ticket_prior_state: string | null
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
  // The original purchase's PaymentIntent lives on the order — embedded so the
  // approve path can issue a Stripe refund without a second query.
  attend_orders: { stripe_payment_intent_id: string | null; currency: string } | null
}

// One row of the admin refund queue: the request with display context embedded.
export interface RefundQueueRow {
  id: string
  status: string
  recommendation: string | null
  reason: string | null
  amount_cents: number | null
  created_at: string
  attend_events: { title: string } | null
  attend_tickets: { state: string; attend_ticket_types: { name: string } | null } | null
}

// The evidence bundle: one ticket with everything the evidence builder needs
// embedded via PostgREST joins (event + its stream, order, attendance, transfers).
export interface TicketEvidenceBundle {
  id: string
  state: string
  checked_in_at: string | null
  attend_events: {
    id: string
    title: string
    status: string
    starts_at: string | null
    ends_at: string | null
    refund_cutoff_hours: number
    attend_streams: { status: string; started_at: string | null; ended_at: string | null }[]
  }
  attend_orders: {
    id: string
    status: string
    total_cents: number
    created_at: string
    policy_snapshot: Record<string, unknown>
    stripe_payment_intent_id: string | null
    buyer_id: string
  }
  attend_attendance_sessions: {
    joined_at: string
    left_at: string | null
    watch_seconds: number
    device: string | null
    browser: string | null
    ip_hash: string | null
  }[]
  attend_ticket_transfers: {
    method: string
    status: string
    created_at: string
    accepted_at: string | null
  }[]
}

/** One ticket with the event, stream, order, attendance and transfers embedded. */
export async function getTicketEvidenceBundle(
  ticketId: string,
): Promise<TicketEvidenceBundle | null> {
  const res = await supaGet(
    'attend_tickets',
    `id=eq.${ticketId}&select=id,state,checked_in_at,` +
      `attend_events(id,title,status,starts_at,ends_at,refund_cutoff_hours,` +
      `attend_streams(status,started_at,ended_at)),` +
      `attend_orders(id,status,total_cents,created_at,policy_snapshot,` +
      `stripe_payment_intent_id,buyer_id),` +
      `attend_attendance_sessions(joined_at,left_at,watch_seconds,device,browser,ip_hash),` +
      `attend_ticket_transfers(method,status,created_at,accepted_at)`,
  )
  if (!res.ok) throw new Error(`attend_tickets evidence query failed: ${res.status}`)
  const rows = (await res.json()) as TicketEvidenceBundle[]
  return rows[0] ?? null
}

export async function getRefundRequestById(id: string): Promise<RefundRequestRow | null> {
  const res = await supaGet(
    'attend_refund_requests',
    `id=eq.${id}&select=*,attend_orders(stripe_payment_intent_id,currency)`,
  )
  if (!res.ok) throw new Error(`attend_refund_requests query failed: ${res.status}`)
  const rows = (await res.json()) as RefundRequestRow[]
  return rows[0] ?? null
}

/** The admin queue: refund requests in an open status, oldest first (FIFO). */
export async function listRefundQueue(statuses: string[]): Promise<RefundQueueRow[]> {
  const res = await supaGet(
    'attend_refund_requests',
    `status=in.(${statuses.join(',')})&select=id,status,recommendation,reason,` +
      `amount_cents,created_at,attend_events(title),` +
      `attend_tickets(state,attend_ticket_types(name))&order=created_at.asc`,
  )
  if (!res.ok) throw new Error(`attend_refund_requests queue query failed: ${res.status}`)
  return (await res.json()) as RefundQueueRow[]
}

/** Insert the §17 evidence packet for a refund request; returns its id. */
export async function insertEvidencePacket(args: {
  refundRequestId: string
  payload: Record<string, unknown>
}): Promise<{ id: string }> {
  const res = await supaPost(
    'attend_evidence_packets',
    { subject_type: 'REFUND', refund_request_id: args.refundRequestId, payload: args.payload },
    'return=representation',
  )
  if (!res.ok) {
    throw new Error(`attend_evidence_packets insert failed: ${res.status} ${await res.text()}`)
  }
  const rows = (await res.json()) as { id: string }[]
  if (rows.length === 0) throw new Error('attend_evidence_packets insert returned no row')
  return rows[0]
}

export async function updateRefundRequest(
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const res = await supaPatch('attend_refund_requests', `id=eq.${id}`, {
    ...patch,
    updated_at: new Date().toISOString(),
  })
  if (!res.ok) {
    throw new Error(`attend_refund_requests update failed: ${res.status} ${await res.text()}`)
  }
}
