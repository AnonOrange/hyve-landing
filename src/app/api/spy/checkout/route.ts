import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripeKey = process.env.STRIPE_SECRET_KEY
const monthlyPriceId = process.env.STRIPE_SPY_PRICE_ID
const annualPriceId = process.env.STRIPE_SPY_ANNUAL_PRICE_ID
const proMonthlyPriceId = process.env.STRIPE_SPY_PRO_PRICE_ID
const proAnnualPriceId = process.env.STRIPE_SPY_PRO_ANNUAL_PRICE_ID

function pickPriceId(plan: string | null, tier: string | null) {
  const isAnnual = (plan || '').toLowerCase() === 'annual'
  const isPro = (tier || '').toLowerCase() === 'pro'
  if (isPro && isAnnual && proAnnualPriceId) return proAnnualPriceId
  if (isPro && proMonthlyPriceId) return proMonthlyPriceId
  if (isAnnual && annualPriceId) return annualPriceId
  return monthlyPriceId || null
}

async function createSession(req: NextRequest, plan: string | null, tier: string | null, email?: string) {
  if (!stripeKey) return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  const priceId = pickPriceId(plan, tier)
  if (!priceId) return NextResponse.json({ error: `Price not configured for plan=${plan || 'monthly'} tier=${tier || 'basic'}` }, { status: 503 })

  const stripe = new Stripe(stripeKey)
  const origin = req.headers.get('origin') || `https://${req.headers.get('host') || 'hyveapp.co'}`

  const resolvedPlan = plan || 'monthly'
  const resolvedTier = (tier || 'basic').toLowerCase() === 'pro' ? 'pro' : 'basic'

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    ...(email ? { customer_email: email } : {}),
    success_url: `${origin}/spy/welcome?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/spy#pricing`,
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    subscription_data: {
      // Removed the 3-day free trial — users wanting a no-cost option now
      // sign up via /spy/sign-up-free for the ad-supported tier instead.
      // Trial-via-Stripe was confusing alongside a real free tier.
      metadata: { product: 'hyve_spy', plan: resolvedPlan, tier: resolvedTier, ...(email ? { email } : {}) },
    },
    payment_method_collection: 'always',
    metadata: { product: 'hyve_spy', plan: resolvedPlan, tier: resolvedTier },
  })

  return session
}

// GET: redirect-style checkout (used by the new pricing CTAs)
//   /api/spy/checkout?plan=monthly|annual&tier=basic|pro
export async function GET(req: NextRequest) {
  const plan = req.nextUrl.searchParams.get('plan')
  const tier = req.nextUrl.searchParams.get('tier')
  try {
    const session = await createSession(req, plan, tier)
    if (session instanceof NextResponse) return session
    if (!session.url) throw new Error('Stripe did not return a checkout URL')
    return NextResponse.redirect(session.url, { status: 303 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST: kept for the legacy email-form flow (existing SpyPricing component)
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; plan?: string; tier?: string }
  const email = body.email
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }
  try {
    const session = await createSession(req, body.plan ?? null, body.tier ?? null, email)
    if (session instanceof NextResponse) return session
    return NextResponse.json({ url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
