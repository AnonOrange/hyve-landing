import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripeKey = process.env.STRIPE_SECRET_KEY
const SUPA_URL = process.env.SUPABASE_URL
const SUPA_SERVICE = process.env.SUPABASE_SERVICE_KEY

/**
 * POST /api/spy/account/delete
 *
 * Hard-deletes a Hyve Spy account. Multi-step because the user data is
 * spread across Stripe (subscription + customer record) and Supabase
 * (alert subscriptions, watchlist, FOIA log, etc.):
 *
 *   1. Cancel the active Stripe subscription (immediately, no proration)
 *   2. Detach Stripe customer payment methods
 *   3. Delete user-owned rows in Supabase tables keyed by email
 *   4. Clear all auth + tier cookies on the response
 *
 * The user is identified by their hyve_spy_session cookie (Stripe Checkout
 * session id) — same as verify-session. Caller must confirm intent in the UI
 * (we just enforce the destructive action; the warning is the client's job).
 *
 * Body shape:
 *   { confirm: "DELETE" }   — required to ensure no accidental wipes
 */
export async function POST(req: NextRequest) {
  const sessionId = req.cookies.get('hyve_spy_session')?.value
  if (!sessionId) {
    return NextResponse.json({ error: 'no_session' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  if (body?.confirm !== 'DELETE') {
    return NextResponse.json({ error: 'confirmation_required', hint: "send { confirm: 'DELETE' }" }, { status: 400 })
  }

  // Comp-access accounts can be deleted simply by clearing cookies — no
  // Stripe customer to clean up.
  const isComp = sessionId.startsWith('comp:')

  let canceledSubscriptionId: string | null = null
  let detachedPaymentMethods = 0
  let userEmail: string | null = null

  if (!isComp) {
    if (!stripeKey) {
      return NextResponse.json({ error: 'stripe_not_configured' }, { status: 503 })
    }
    const stripe = new Stripe(stripeKey)

    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['customer', 'subscription'],
      })
      userEmail = (session.customer_email || session.customer_details?.email || '').toLowerCase() || null

      const subscriptionId =
        typeof session.subscription === 'string' ? session.subscription : session.subscription?.id

      // Step 1: cancel the live subscription. Use cancel(), not update(), so
      // it stops immediately and the user loses access right away.
      if (subscriptionId) {
        try {
          const sub = await stripe.subscriptions.cancel(subscriptionId)
          canceledSubscriptionId = sub.id
        } catch (e) {
          // Already canceled? That's fine — log and continue.
          console.warn('[account.delete] subscription cancel failed', (e as Error).message)
        }
      }

      // Step 2: detach payment methods so the customer record can't be reused
      const customerId =
        typeof session.customer === 'string' ? session.customer : session.customer?.id
      if (customerId) {
        const methods = await stripe.paymentMethods.list({ customer: customerId, limit: 100 })
        for (const m of methods.data) {
          try {
            await stripe.paymentMethods.detach(m.id)
            detachedPaymentMethods++
          } catch {}
        }
      }
    } catch (e) {
      console.error('[account.delete] stripe lookup failed', (e as Error).message)
      // Continue to Supabase cleanup even if Stripe step partially failed —
      // user still wants their data deleted.
    }
  }

  // Step 3: wipe user data from Supabase. Tables are listed explicitly so
  // we never accidentally delete from something newly added without review.
  let supabaseRows = 0
  if (userEmail && SUPA_URL && SUPA_SERVICE) {
    const tables = [
      // alert_subscriptions: push notification config (radius, severity, etc.)
      `alert_subscriptions?email=eq.${encodeURIComponent(userEmail)}`,
      // sentinel_audits: any one-shot security audits the user purchased
      `sentinel_audits?user_email=eq.${encodeURIComponent(userEmail)}`,
      // Add new email-keyed tables here as the schema evolves.
    ]
    for (const path of tables) {
      try {
        const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
          method: 'DELETE',
          headers: {
            apikey: SUPA_SERVICE,
            Authorization: `Bearer ${SUPA_SERVICE}`,
            Prefer: 'return=representation',
          },
        })
        if (r.ok) {
          const removed = (await r.json().catch(() => [])) as unknown[]
          supabaseRows += Array.isArray(removed) ? removed.length : 0
        }
      } catch (e) {
        console.warn('[account.delete] supabase delete failed', (e as Error).message)
      }
    }
  }

  // Step 4: clear auth + tier cookies on the response so the browser session
  // ends immediately. Mobile clients should call /api/spy/signout or wipe
  // local AuthPreferences in parallel — this only affects the web side.
  const r = NextResponse.json({
    ok: true,
    canceled: canceledSubscriptionId,
    detachedPaymentMethods,
    supabaseRows,
    email: userEmail,
  })
  for (const cookie of ['hyve_spy_session', 'hyve_account', 'hyve_spy_tier']) {
    r.cookies.set(cookie, '', { path: '/', maxAge: 0, sameSite: 'lax', secure: true })
  }
  return r
}

export const dynamic = 'force-dynamic'
