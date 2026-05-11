// /api/caseline/checkout — Stripe Checkout session creator for CaseLine.
// Mirrors /api/spy/checkout so the umbrella webhook can treat all products
// uniformly via metadata.

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripeKey = process.env.STRIPE_SECRET_KEY
const PRICE_5  = process.env.STRIPE_CASELINE_5_PRICE_ID  // STARTER — 5 seats
const PRICE_10 = process.env.STRIPE_CASELINE_10_PRICE_ID // FIRM    — 10 seats

function pickPriceId(tier: string | null): string | null {
  if (tier === '10') return PRICE_10 || null
  // default to 5-seat STARTER for any unknown/missing tier
  return PRICE_5 || null
}

async function createSession(req: NextRequest, tier: string | null, opts: { email?: string; firmName?: string } = {}) {
  if (!stripeKey) return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  const priceId = pickPriceId(tier)
  if (!priceId) return NextResponse.json({ error: `Price not configured for tier=${tier || '5'}` }, { status: 503 })

  const stripe = new Stripe(stripeKey)
  const origin = req.headers.get('origin') || `https://${req.headers.get('host') || 'hyveapp.co'}`

  const resolvedTier = tier === '10' ? '10' : '5'

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    ...(opts.email ? { customer_email: opts.email } : {}),
    success_url: `${origin}/caseline/welcome?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${origin}/caseline#pricing`,
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    subscription_data: {
      metadata: {
        product: 'hyve_caseline',
        tier: resolvedTier,
        ...(opts.firmName ? { firm_name: opts.firmName } : {}),
        ...(opts.email ? { email: opts.email } : {}),
      },
    },
    metadata: {
      product: 'hyve_caseline',
      tier: resolvedTier,
      ...(opts.firmName ? { firm_name: opts.firmName } : {}),
    },
  })

  return session
}

// GET: redirect-style checkout — used by direct CTA buttons.
//   /api/caseline/checkout?tier=5  or  ?tier=10
export async function GET(req: NextRequest) {
  const tier = req.nextUrl.searchParams.get('tier')
  try {
    const session = await createSession(req, tier)
    if (session instanceof NextResponse) return session
    if (!session.url) throw new Error('Stripe did not return a checkout URL')
    return NextResponse.redirect(session.url, { status: 303 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST: form-driven checkout — captures firm name + email up front so the
// receipt email and Firestore license entry have full context.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; firmName?: string; tier?: string }
  const email = body.email?.trim()
  const firmName = body.firmName?.trim()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }
  if (!firmName || firmName.length < 2) {
    return NextResponse.json({ error: 'Firm name required' }, { status: 400 })
  }
  try {
    const session = await createSession(req, body.tier ?? null, { email, firmName })
    if (session instanceof NextResponse) return session
    return NextResponse.json({ url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
