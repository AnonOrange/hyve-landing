// HYVE Attend ticket checkout: open a Stripe Checkout session for a ticket
// order, and fulfil it once payment confirms. The money-critical multi-table
// writes are the attend_create_pending_order / attend_complete_checkout RPCs.
import type Stripe from 'stripe'
import { attendStripe } from '@/lib/attend/payments/stripe'
import { calculateFees, type ShowType } from '@/lib/attend/payments/fee-calculator'
import { priceSelections, type Selection } from '@/lib/attend/payments/checkout-pricing'
import { insertPayment, findPaymentBySession } from '@/lib/attend/payments/payments-repository'
import { getEventById } from '@/lib/attend/events/repository'
import { listTicketTypesByEvent } from '@/lib/attend/ticketing/ticket-type-repository'
import { NotFoundError, ValidationError } from '@/lib/attend/events/service'
import { supaPost, supaPatch } from '@/lib/supabase'

/**
 * Start a ticket checkout: validate + price the selection, atomically create a
 * PENDING order holding the inventory, then open a Stripe Checkout session.
 */
export async function startCheckout(
  buyerId: string,
  eventId: string,
  selections: Selection[],
  origin: string,
): Promise<{ url: string }> {
  const event = await getEventById(eventId)
  if (!event) throw new NotFoundError('Event not found')
  if (event.status !== 'ON_SALE') throw new ValidationError('This event is not on sale')

  const ticketTypes = await listTicketTypesByEvent(eventId)
  const { items, subtotalCents } = priceSelections(selections, ticketTypes)
  const totalSeats = items.reduce((n, it) => n + it.quantity, 0)

  const fees = calculateFees({
    showType: event.show_type as ShowType,
    ticketSubtotalCents: subtotalCents,
    quantity: totalSeats,
    feeMode: 'ABSORB',
    taxEstimateCents: 0,
    discountsCents: 0,
    currency: 'usd',
  })

  // Atomic: hold inventory + create the PENDING order and its HELD_IN_CART tickets.
  const orderRes = await supaPost('rpc/attend_create_pending_order', {
    p_args: {
      buyer_id: buyerId,
      event_id: eventId,
      items: items.map((it) => ({ ticket_type_id: it.ticketTypeId, quantity: it.quantity })),
      subtotal_cents: fees.ticketSubtotalCents,
      hyve_fee_cents: fees.hyvePlatformFeeCents,
      processor_fee_cents: fees.processorFeeCents,
      tax_cents: fees.taxCents,
      total_cents: fees.buyerTotalCents,
      currency: 'usd',
      fee_mode: 'ABSORB',
    },
  })
  if (!orderRes.ok) {
    throw new Error(
      `attend_create_pending_order RPC failed: ${orderRes.status} ${await orderRes.text()}`,
    )
  }
  const { order_id: orderId } = (await orderRes.json()) as { order_id: string }

  // One Stripe line item per tier; under ABSORB with 0 tax their sum is the
  // buyer total. metadata carries the ids the fulfilment webhook needs.
  const session = await attendStripe().checkout.sessions.create({
    mode: 'payment',
    line_items: items.map((it) => ({
      quantity: it.quantity,
      price_data: {
        currency: 'usd',
        unit_amount: it.unitPriceCents,
        product_data: { name: it.name },
      },
    })),
    metadata: {
      attend_kind: 'ticket_order',
      attend_order_id: orderId,
      attend_event_id: eventId,
      attend_buyer_id: buyerId,
    },
    success_url: `${origin}/attend/events/${event.slug}?purchased=1`,
    cancel_url: `${origin}/attend/events/${event.slug}?cancelled=1`,
  })

  // Record the session id so the Phase 3c cart-expiry job can reclaim the hold.
  await supaPatch('attend_orders', `id=eq.${orderId}`, {
    stripe_checkout_session_id: session.id,
  })

  if (!session.url) throw new Error('Stripe did not return a checkout URL')
  return { url: session.url }
}

/**
 * Fulfil a completed ticket checkout: record the payment, then run the atomic
 * attend_complete_checkout RPC. Called from the Stripe webhook only.
 */
export async function fulfilCheckout(session: Stripe.Checkout.Session): Promise<void> {
  const orderId = session.metadata?.attend_order_id
  const eventId = session.metadata?.attend_event_id
  const buyerId = session.metadata?.attend_buyer_id
  if (!orderId || !eventId || !buyerId) {
    throw new Error('ticket_order session missing metadata')
  }

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : (session.payment_intent?.id ?? null)

  // Idempotent: dedup on the Checkout session id, so a retried delivery reuses
  // the recorded payment.
  let payment = await findPaymentBySession(session.id)
  if (!payment) {
    payment = await insertPayment({
      kind: 'TICKET_PURCHASE',
      order_id: orderId,
      event_id: eventId,
      profile_id: buyerId,
      amount_cents: session.amount_total ?? 0,
      currency: session.currency ?? 'usd',
      status: 'SUCCEEDED',
      stripe_payment_intent_id: paymentIntentId,
      stripe_charge_id: null,
      stripe_refund_id: null,
      stripe_checkout_session_id: session.id,
    })
  }

  const res = await supaPost('rpc/attend_complete_checkout', {
    p_args: {
      order_id: orderId,
      payment_id: payment.id,
      stripe_payment_intent_id: paymentIntentId,
    },
  })
  if (!res.ok) {
    throw new Error(`attend_complete_checkout RPC failed: ${res.status} ${await res.text()}`)
  }
  // The RPC no-ops (completed: false) if the order was cancelled before the
  // payment landed — the buyer paid a cancelled order and is owed a refund.
  const result = (await res.json().catch(() => ({}))) as { status?: string; completed?: boolean }
  if (result.completed === false) {
    console.error(
      `[attend checkout] order ${orderId} was ${result.status} at payment — ` +
        'buyer paid a non-pending order; a refund is owed',
    )
  }
}
