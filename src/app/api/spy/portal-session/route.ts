import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripeKey = process.env.STRIPE_SECRET_KEY

/**
 * GET /api/spy/portal-session
 *
 * Creates a Stripe Customer Billing Portal session for the user identified by
 * the `hyve_spy_session` cookie (Stripe Checkout session id), then 303s the
 * browser straight into the portal.
 */
export async function GET(req: NextRequest) {
  const sessionId = req.cookies.get('hyve_spy_session')?.value
  if (!sessionId) {
    return NextResponse.redirect(new URL('/spy#pricing', req.url), { status: 303 })
  }

  if (!stripeKey) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const stripe = new Stripe(stripeKey)

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    const customerId =
      typeof session.customer === 'string'
        ? session.customer
        : session.customer?.id
    if (!customerId) {
      return NextResponse.json({ error: 'No customer on session' }, { status: 404 })
    }

    const origin = req.headers.get('origin') || `https://${req.headers.get('host') || 'hyveapp.co'}`

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/spy/app/settings`,
    })

    return NextResponse.redirect(portal.url, { status: 303 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
