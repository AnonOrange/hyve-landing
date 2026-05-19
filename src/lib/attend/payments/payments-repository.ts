// Raw-REST data access for attend_payments and attend_webhook_events.
import { supaGet, supaPost, supaPatch, supaDelete } from '@/lib/supabase'

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
  stripe_checkout_session_id: string | null
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

/** Look up a payment by its Stripe Checkout session id (the dedup key). */
export async function findPaymentBySession(
  stripeCheckoutSessionId: string,
): Promise<PaymentRow | null> {
  const res = await supaGet(
    'attend_payments',
    `stripe_checkout_session_id=eq.${stripeCheckoutSessionId}&select=*`,
  )
  if (!res.ok) throw new Error(`attend_payments query failed: ${res.status}`)
  const r = (await res.json()) as PaymentRow[]
  return r[0] ?? null
}

/**
 * Atomically claim a webhook event for processing. Inserts the event row; the
 * `unique(provider_event_id)` constraint makes the insert itself the claim:
 *   - res.ok → this caller claimed it (process the event)
 *   - 409    → another delivery already claimed it (returns false)
 */
export async function claimWebhookEvent(
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
  if (res.status === 409) return false
  throw new Error(`attend_webhook_events claim failed: ${res.status} ${await res.text()}`)
}

/** True once this event's handler has completed successfully. */
export async function isWebhookProcessed(providerEventId: string): Promise<boolean> {
  const res = await supaGet(
    'attend_webhook_events',
    `provider_event_id=eq.${providerEventId}&select=processed_at`,
  )
  if (!res.ok) throw new Error(`attend_webhook_events query failed: ${res.status}`)
  const rows = (await res.json()) as { processed_at: string | null }[]
  return rows.length > 0 && rows[0].processed_at !== null
}

/** Release a claim whose handler failed, so a Stripe retry can re-claim it. */
export async function releaseWebhookClaim(providerEventId: string): Promise<void> {
  const res = await supaDelete(
    'attend_webhook_events',
    `provider_event_id=eq.${providerEventId}`,
  )
  if (!res.ok) {
    console.error(
      `[attend webhook] failed to release claim ${providerEventId}: ${res.status}`,
    )
  }
}

export async function markWebhookProcessed(providerEventId: string): Promise<void> {
  const res = await supaPatch(
    'attend_webhook_events',
    `provider_event_id=eq.${providerEventId}`,
    { processed_at: new Date().toISOString() },
  )
  if (!res.ok) throw new Error(`attend_webhook_events update failed: ${res.status}`)
}
