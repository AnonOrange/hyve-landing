// HYVE Attend — the $50 show-registration fee: start a Stripe Checkout
// session and fulfil it (record the payment, run the atomic RPC).
import type Stripe from 'stripe'
import { attendStripe, REGISTRATION_FEE_CENTS } from '@/lib/attend/payments/stripe'
import { insertPayment } from '@/lib/attend/payments/payments-repository'
import { getEventById } from '@/lib/attend/events/repository'
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/attend/events/service'
import { supaPost } from '@/lib/supabase'

/** Open a one-time Stripe Checkout session for the $50 registration fee. */
export async function startRegistrationCheckout(
  eventId: string,
  creatorId: string,
  origin: string,
): Promise<{ url: string }> {
  const event = await getEventById(eventId)
  if (!event) throw new NotFoundError('Event not found')
  if (event.creator_id !== creatorId) throw new ForbiddenError('This is not your event')
  if (event.status !== 'REGISTRATION_PENDING') {
    throw new ValidationError('This event is not awaiting the registration fee')
  }

  const session = await attendStripe().checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: REGISTRATION_FEE_CENTS,
          product_data: { name: 'HYVE Attend — show registration' },
        },
      },
    ],
    metadata: {
      attend_kind: 'registration',
      attend_event_id: eventId,
      attend_actor: creatorId,
    },
    success_url: `${origin}/attend/creator?registered=1`,
    cancel_url: `${origin}/attend/creator?cancelled=1`,
  })

  if (!session.url) throw new Error('Stripe did not return a checkout URL')
  return { url: session.url }
}

/**
 * Fulfil a completed registration checkout: record the payment, then run the
 * atomic attend_pay_registration RPC. Called from the Stripe webhook only.
 */
export async function fulfilRegistration(session: Stripe.Checkout.Session): Promise<void> {
  const eventId = session.metadata?.attend_event_id
  const actor = session.metadata?.attend_actor
  if (!eventId || !actor) throw new Error('registration session missing metadata')

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : (session.payment_intent?.id ?? null)

  const payment = await insertPayment({
    kind: 'REGISTRATION_FEE',
    order_id: null,
    event_id: eventId,
    profile_id: actor,
    amount_cents: REGISTRATION_FEE_CENTS,
    currency: session.currency ?? 'usd',
    status: 'SUCCEEDED',
    stripe_payment_intent_id: paymentIntentId,
    stripe_charge_id: null,
    stripe_refund_id: null,
  })

  // PostgREST keys the RPC body by the function's jsonb parameter name.
  const res = await supaPost('rpc/attend_pay_registration', {
    p_args: { event_id: eventId, payment_id: payment.id, actor },
  })
  if (!res.ok) {
    throw new Error(`attend_pay_registration RPC failed: ${res.status} ${await res.text()}`)
  }
}
