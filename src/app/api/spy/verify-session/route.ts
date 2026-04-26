import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripeKey = process.env.STRIPE_SECRET_KEY

const ACTIVE_STATUSES = new Set<Stripe.Subscription.Status>([
  'active',
  'trialing',
  'past_due', // grace period — still let them in until Stripe flips to canceled/unpaid
])

/**
 * GET /api/spy/verify-session
 *
 * Reads the `hyve_spy_session` cookie (a Stripe Checkout session id), looks up
 * the underlying subscription, and reports whether it's still entitled.
 *
 * Always asks Stripe live — the cookie alone is not trusted. Cheap enough at
 * MVP scale; swap for a cached-per-customer check once we outgrow it.
 */
export async function GET(req: NextRequest) {
  const sessionId = req.cookies.get('hyve_spy_session')?.value
  if (!sessionId) {
    return NextResponse.json(
      { active: false, reason: 'no_session' },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  if (!stripeKey) {
    return NextResponse.json(
      { active: false, reason: 'stripe_not_configured' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const stripe = new Stripe(stripeKey)

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id
    if (!subscriptionId) {
      return NextResponse.json(
        { active: false, reason: 'no_subscription' },
        { status: 200, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const sub = await stripe.subscriptions.retrieve(subscriptionId)
    const active = ACTIVE_STATUSES.has(sub.status)
    // current_period_end is on every Subscription; type widens it across SDK versions.
    const currentPeriodEnd =
      (sub as unknown as { current_period_end?: number }).current_period_end ?? null

    return NextResponse.json(
      {
        active,
        status: sub.status,
        currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { active: false, reason: 'lookup_failed', error: message },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
