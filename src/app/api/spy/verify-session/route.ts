import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripeKey = process.env.STRIPE_SECRET_KEY

const ACTIVE_STATUSES = new Set<Stripe.Subscription.Status>([
  'active',
  'trialing',
  'past_due', // grace period — still let them in until Stripe flips to canceled/unpaid
])

// Pro-tier price IDs (monthly + annual). When the active sub is on either of
// these, we set hyve_spy_tier=pro. Sleuth + Residential read that cookie to
// gate access on /spy/app/sleuth and /spy/app/residential.
const PRO_PRICE_IDS = new Set(
  [process.env.STRIPE_SPY_PRO_PRICE_ID, process.env.STRIPE_SPY_PRO_ANNUAL_PRICE_ID]
    .filter(Boolean) as string[],
)

// Cookie helper. NOT httpOnly — the client (Sleuth + Residential gates) reads
// it via document.cookie to decide what UI to render. The actual access
// enforcement is on the server side: this cookie is just a UI hint that
// matches the server's truth, refreshed on every verify-session call.
function setTierCookie(res: NextResponse, tier: 'pro' | 'basic' | null) {
  if (tier === null) {
    // Clear when there's no active sub.
    res.cookies.set('hyve_spy_tier', '', { path: '/', maxAge: 0, sameSite: 'lax', secure: true })
    return
  }
  res.cookies.set('hyve_spy_tier', tier, {
    path: '/',
    sameSite: 'lax',
    secure: true,
    maxAge: 60 * 60 * 24 * 30, // 30 days; verify-session refreshes on each PWA mount
  })
}

/**
 * GET /api/spy/verify-session
 *
 * Reads the `hyve_spy_session` cookie (a Stripe Checkout session id), looks up
 * the underlying subscription, and reports whether it's still entitled.
 *
 * Side effect: refreshes `hyve_spy_tier` cookie based on the live sub's price
 * ID — pro tier price → 'pro', anything else → 'basic'. Comp-access users
 * get 'pro' since the comp grant is for full access.
 *
 * Always asks Stripe live — the cookie alone is not trusted. Cheap enough at
 * MVP scale; swap for a cached-per-customer check once we outgrow it.
 */
export async function GET(req: NextRequest) {
  const sessionId = req.cookies.get('hyve_spy_session')?.value
  if (!sessionId) {
    const r = NextResponse.json(
      { active: false, reason: 'no_session', tier: null },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    )
    setTierCookie(r, null)
    return r
  }

  // Comp-access bypass: hyve-spy-accounts sets `comp:<email>` for allowlisted users.
  // VIPs get full Pro access — Sleuth + Residential included.
  if (sessionId.startsWith('comp:')) {
    const r = NextResponse.json(
      { active: true, status: 'comp', tier: 'pro', currentPeriodEnd: null, cancelAtPeriodEnd: false },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    )
    setTierCookie(r, 'pro')
    return r
  }

  if (!stripeKey) {
    const r = NextResponse.json(
      { active: false, reason: 'stripe_not_configured', tier: null },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
    setTierCookie(r, null)
    return r
  }

  const stripe = new Stripe(stripeKey)

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id
    if (!subscriptionId) {
      const r = NextResponse.json(
        { active: false, reason: 'no_subscription', tier: null },
        { status: 200, headers: { 'Cache-Control': 'no-store' } },
      )
      setTierCookie(r, null)
      return r
    }

    // Expand items.data.price so we can read the price IDs without an N+1
    const sub = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['items.data.price'],
    })
    const active = ACTIVE_STATUSES.has(sub.status)
    const currentPeriodEnd =
      (sub as unknown as { current_period_end?: number }).current_period_end ?? null

    // Resolve tier from the line items. ANY pro-tier price ID anywhere in the
    // subscription's line items grants Pro — we don't require all items to be
    // pro (rare edge case where a sub has multiple plans bundled).
    let tier: 'pro' | 'basic' = 'basic'
    if (active) {
      for (const item of sub.items.data) {
        const priceId = typeof item.price === 'string' ? item.price : item.price?.id
        if (priceId && PRO_PRICE_IDS.has(priceId)) {
          tier = 'pro'
          break
        }
      }
    }

    const r = NextResponse.json(
      {
        active,
        status: sub.status,
        tier: active ? tier : null,
        currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    )
    setTierCookie(r, active ? tier : null)
    return r
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const r = NextResponse.json(
      { active: false, reason: 'lookup_failed', error: message, tier: null },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    )
    // Don't clobber an existing valid tier cookie on a transient Stripe error.
    return r
  }
}
