// Raw-REST data access for the HYVE Attend dispute tables. Query-only — no
// business logic. Server-side only (service-key reads).
import { supaGet, supaPost, supaPatch } from '@/lib/supabase'

export interface DisputeRow {
  id: string
  payment_id: string
  order_id: string
  event_id: string
  stripe_dispute_id: string
  reason: string | null
  status: string
  amount_cents: number
  evidence_packet_id: string | null
  due_by: string | null
  created_at: string
}

// One row of the admin dispute queue, with display context embedded.
export interface DisputeQueueRow {
  id: string
  status: string
  reason: string | null
  amount_cents: number
  due_by: string | null
  created_at: string
  evidence_packet_id: string | null
  attend_events: { title: string } | null
}

// The order-scoped evidence bundle: the order with its event + stream and
// every ticket (plus attendance and transfers) embedded via PostgREST joins.
export interface OrderEvidenceBundle {
  id: string
  status: string
  total_cents: number
  currency: string
  created_at: string
  policy_snapshot: Record<string, unknown>
  stripe_payment_intent_id: string | null
  buyer_id: string
  attend_events: {
    id: string
    title: string
    status: string
    starts_at: string | null
    ends_at: string | null
    attend_streams: { status: string; started_at: string | null; ended_at: string | null }[]
  }
  attend_tickets: {
    id: string
    state: string
    checked_in_at: string | null
    attend_attendance_sessions: {
      joined_at: string
      left_at: string | null
      watch_seconds: number
      device: string | null
      browser: string | null
      ip_hash: string | null
    }[]
    attend_ticket_transfers: { method: string; status: string; created_at: string }[]
  }[]
}

/** The TICKET_PURCHASE payment for a Stripe PaymentIntent (the disputed charge). */
export async function findPaymentByIntent(
  paymentIntentId: string,
): Promise<{ id: string; order_id: string | null; event_id: string | null } | null> {
  const res = await supaGet(
    'attend_payments',
    `stripe_payment_intent_id=eq.${paymentIntentId}&kind=eq.TICKET_PURCHASE` +
      `&select=id,order_id,event_id`,
  )
  if (!res.ok) throw new Error(`attend_payments query failed: ${res.status}`)
  const rows = (await res.json()) as {
    id: string
    order_id: string | null
    event_id: string | null
  }[]
  return rows[0] ?? null
}

export async function getDisputeById(id: string): Promise<DisputeRow | null> {
  const res = await supaGet('attend_disputes', `id=eq.${id}&select=*`)
  if (!res.ok) throw new Error(`attend_disputes query failed: ${res.status}`)
  const rows = (await res.json()) as DisputeRow[]
  return rows[0] ?? null
}

/** Every dispute, newest first — the admin queue (closed disputes included for history). */
export async function listDisputes(): Promise<DisputeQueueRow[]> {
  const res = await supaGet(
    'attend_disputes',
    `select=id,status,reason,amount_cents,due_by,created_at,evidence_packet_id,` +
      `attend_events(title)&order=created_at.desc`,
  )
  if (!res.ok) throw new Error(`attend_disputes queue query failed: ${res.status}`)
  return (await res.json()) as DisputeQueueRow[]
}

/** One order with its event, stream, tickets, attendance and transfers embedded. */
export async function getOrderEvidenceBundle(
  orderId: string,
): Promise<OrderEvidenceBundle | null> {
  const res = await supaGet(
    'attend_orders',
    `id=eq.${orderId}&select=id,status,total_cents,currency,created_at,policy_snapshot,` +
      `stripe_payment_intent_id,buyer_id,` +
      `attend_events(id,title,status,starts_at,ends_at,` +
      `attend_streams(status,started_at,ended_at)),` +
      `attend_tickets(id,state,checked_in_at,` +
      `attend_attendance_sessions(joined_at,left_at,watch_seconds,device,browser,ip_hash),` +
      `attend_ticket_transfers(method,status,created_at))`,
  )
  if (!res.ok) throw new Error(`attend_orders evidence query failed: ${res.status}`)
  const rows = (await res.json()) as OrderEvidenceBundle[]
  return rows[0] ?? null
}

/** Insert the §18 evidence packet for a dispute; returns its id. */
export async function insertDisputeEvidencePacket(args: {
  disputeId: string
  payload: Record<string, unknown>
}): Promise<{ id: string }> {
  const res = await supaPost(
    'attend_evidence_packets',
    { subject_type: 'DISPUTE', dispute_id: args.disputeId, payload: args.payload },
    'return=representation',
  )
  if (!res.ok) {
    throw new Error(`attend_evidence_packets insert failed: ${res.status} ${await res.text()}`)
  }
  const rows = (await res.json()) as { id: string }[]
  if (rows.length === 0) throw new Error('attend_evidence_packets insert returned no row')
  return rows[0]
}

export async function updateDispute(
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const res = await supaPatch('attend_disputes', `id=eq.${id}`, {
    ...patch,
    updated_at: new Date().toISOString(),
  })
  if (!res.ok) {
    throw new Error(`attend_disputes update failed: ${res.status} ${await res.text()}`)
  }
}
