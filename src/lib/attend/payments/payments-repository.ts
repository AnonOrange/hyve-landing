// Raw-REST data access for attend_payments and attend_webhook_events.
import { supaGet, supaPost, supaPatch } from '@/lib/supabase'

export interface PaymentRow {
  id: string
  kind: string
  order_id: string | null
  event_id: string | null
  profile_id: string
  amount_cents: number
  currency: string
  status: string
  stripe_payment_intent_id: string | null
  stripe_charge_id: string | null
  stripe_refund_id: string | null
  created_at: string
  updated_at: string
}

export type NewPaymentRow = Omit<PaymentRow, 'id' | 'created_at' | 'updated_at'>

export async function insertPayment(row: NewPaymentRow): Promise<PaymentRow> {
  const res = await supaPost('attend_payments', row, 'return=representation')
  if (!res.ok) {
    throw new Error(`attend_payments insert failed: ${res.status} ${await res.text()}`)
  }
  const created = (await res.json()) as PaymentRow[]
  if (created.length === 0) throw new Error('attend_payments insert returned no row')
  return created[0]
}

export async function findPaymentByIntent(
  stripePaymentIntentId: string,
): Promise<PaymentRow | null> {
  const res = await supaGet(
    'attend_payments',
    `stripe_payment_intent_id=eq.${stripePaymentIntentId}&select=*`,
  )
  if (!res.ok) throw new Error(`attend_payments query failed: ${res.status}`)
  const r = (await res.json()) as PaymentRow[]
  return r[0] ?? null
}

/**
 * Record a webhook delivery. Returns true if newly recorded, false if the
 * `provider_event_id` was already present (a duplicate delivery). Decided by
 * HTTP status — never depends on parsing the response body.
 */
export async function markWebhookSeen(
  provider: string,
  providerEventId: string,
  eventType: string,
  payload: unknown,
): Promise<boolean> {
  const res = await supaPost(
    'attend_webhook_events',
    { provider, provider_event_id: providerEventId, event_type: eventType, payload },
    'return=minimal',
  )
  if (res.ok) return true
  if (res.status === 409) return false // unique(provider_event_id) — already seen
  throw new Error(`attend_webhook_events insert failed: ${res.status} ${await res.text()}`)
}

export async function markWebhookProcessed(providerEventId: string): Promise<void> {
  const res = await supaPatch(
    'attend_webhook_events',
    `provider_event_id=eq.${providerEventId}`,
    { processed_at: new Date().toISOString() },
  )
  if (!res.ok) throw new Error(`attend_webhook_events update failed: ${res.status}`)
}
