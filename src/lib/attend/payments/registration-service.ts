// HYVE Attend — the $50 show-registration fee: start a Stripe Checkout
// session and fulfil it (record the payment, run the atomic RPC).
//
// Also home to the "first 2 shows free" credit logic: freeRegistrationsRemaining
// asks the DB how many free slots a creator has left, and grantFreeRegistration
// consumes a slot via the atomic attend_grant_free_registration RPC.
import type Stripe from 'stripe'
import { attendStripe, REGISTRATION_FEE_CENTS } from '@/lib/attend/payments/stripe'
import { insertPayment, findPaymentBySession } from '@/lib/attend/payments/payments-repository'
import { getEventById } from '@/lib/attend/events/repository'
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/attend/events/service'
import { supaGet, supaPost } from '@/lib/supabase'

export const FREE_REGISTRATION_CAP = 2

/**
 * How many free-registration slots this creator has left. The DB is the
 * source of truth — this is the count for UI hints. The RPC also re-checks
 * under a row lock, so a stale read here can't cause an over-grant.
 */
export async function freeRegistrationsRemaining(creatorId: string): Promise<number> {
  const res = await supaGet(
    'attend_events',
    `select=id&creator_id=eq.${encodeURIComponent(creatorId)}&was_free_registration=eq.true&deleted_at=is.null`,
  )
  if (!res.ok) {
    throw new Error(`free-registrations count failed: ${res.status} ${await res.text()}`)
  }
  const rows = (await res.json()) as Array<{ id: string }>
  return Math.max(0, FREE_REGISTRATION_CAP - rows.length)
}

/**
 * Beta path: grant the show registration with no fee and no credit
 * consumption. The was_beta_registration column on attend_events marks
 * the row for later reporting. Guards match the paid + free paths so
 * the same ownership + lifecycle errors come back consistently.
 */
export async function grantBetaRegistration(
  eventId: string,
  creatorId: string,
): Promise<{ ok: true; beta: true }> {
  const event = await getEventById(eventId)
  if (!event) throw new NotFoundError('Event not found')
  if (event.creator_id !== creatorId) throw new ForbiddenError('This is not your event')
  if (event.status !== 'REGISTRATION_PENDING') {
    throw new ValidationError('This event is not awaiting the registration fee')
  }
  const res = await supaPost('rpc/attend_grant_beta_registration', {
    p_args: { event_id: eventId, actor: creatorId },
  })
  if (!res.ok) {
    throw new Error(`attend_grant_beta_registration RPC failed: ${res.status} ${await res.text()}`)
  }
  return { ok: true, beta: true }
}

/**
 * Consume one of the creator's free-registration credits for this event.
 * Mirrors startRegistrationCheckout's guards (ownership + status) and then
 * delegates the atomic state changes to the DB RPC.
 */
export async function grantFreeRegistration(
  eventId: string,
  creatorId: string,
): Promise<{ ok: true; free: true; used: number; remaining: number }> {
  const event = await getEventById(eventId)
  if (!event) throw new NotFoundError('Event not found')
  if (event.creator_id !== creatorId) throw new ForbiddenError('This is not your event')
  if (event.status !== 'REGISTRATION_PENDING') {
    throw new ValidationError('This event is not awaiting the registration fee')
  }

  const res = await supaPost('rpc/attend_grant_free_registration', {
    p_args: { event_id: eventId, actor: creatorId },
  })
  if (!res.ok) {
    const body = await res.text()
    if (body.includes('NO_FREE_CREDITS')) {
      throw new ValidationError('No free registrations remaining')
    }
    throw new Error(`attend_grant_free_registration RPC failed: ${res.status} ${body}`)
  }
  const data = (await res.json()) as { used?: number; remaining?: number }
  return {
    ok: true,
    free: true,
    used: data.used ?? FREE_REGISTRATION_CAP,
    remaining: data.remaining ?? 0,
  }
}

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

  // Idempotent: dedup on the Checkout session id (always present, unlike the
  // payment intent), so a retried delivery reuses the recorded payment.
  let payment = await findPaymentBySession(session.id)
  if (!payment) {
    payment = await insertPayment({
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
      stripe_checkout_session_id: session.id,
    })
  }

  // PostgREST keys the RPC body by the function's jsonb parameter name.
  const res = await supaPost('rpc/attend_pay_registration', {
    p_args: { event_id: eventId, payment_id: payment.id, actor },
  })
  if (!res.ok) {
    throw new Error(`attend_pay_registration RPC failed: ${res.status} ${await res.text()}`)
  }
}
