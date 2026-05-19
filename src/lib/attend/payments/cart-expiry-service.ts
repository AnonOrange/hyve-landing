// HYVE Attend cart expiry — reclaims abandoned PENDING orders. A Stripe
// Checkout session lives at most 24h; a PENDING order older than
// CART_HOLD_HOURS is definitively unpaid, so its held inventory is released
// via the atomic attend_expire_order RPC. This also catches orders left with a
// null stripe_checkout_session_id by a failed startCheckout.
import { supaGet, supaPost } from '@/lib/supabase'

const CART_HOLD_HOURS = 25

export async function expireStaleCarts(): Promise<{ scanned: number; expired: number }> {
  const cutoff = new Date(Date.now() - CART_HOLD_HOURS * 3_600_000).toISOString()

  const res = await supaGet(
    'attend_orders',
    `status=eq.PENDING&created_at=lt.${cutoff}&select=id`,
  )
  if (!res.ok) {
    throw new Error(`cart-expiry order scan failed: ${res.status} ${await res.text()}`)
  }
  const orders = (await res.json()) as { id: string }[]

  // Expire each order independently — one failure must not abort the run; the
  // job is idempotent, so a skipped order is retried on the next tick.
  let expired = 0
  for (const order of orders) {
    try {
      const rpc = await supaPost('rpc/attend_expire_order', { p_args: { order_id: order.id } })
      if (!rpc.ok) {
        console.error(
          `[cart-expiry] attend_expire_order failed for ${order.id}: ` +
            `${rpc.status} ${await rpc.text()}`,
        )
        continue
      }
      const result = (await rpc.json()) as { expired?: boolean }
      if (result.expired) expired += 1
    } catch (err) {
      console.error(`[cart-expiry] error expiring ${order.id}:`, (err as Error).message)
    }
  }
  return { scanned: orders.length, expired }
}
