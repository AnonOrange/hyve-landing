import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })

// Sentinel one-shot audit pricing.
// One-time charge — no subscription. User pays, gets a single audit report.
const TIERS: Record<string, { name: string; quota: number; cents: number }> = {
  personal: { name: 'Sentinel · Personal Audit', quota: 5,   cents:  999 },
  family:   { name: 'Sentinel · Family Audit',   quota: 20,  cents: 1999 },
  business: { name: 'Sentinel · Business Audit', quota: 100, cents: 4999 },
}

export async function POST(req: NextRequest) {
  const { tier = 'personal', email } = await req.json().catch(() => ({}))
  const t = TIERS[tier]
  if (!t) return NextResponse.json({ error: 'invalid tier' }, { status: 400 })

  // Build checkout session — one-time payment mode, NOT subscription.
  // Success URL routes to the audit setup wizard with the session id, which
  // the wizard uses to create the sentinel_audits row server-side after the
  // Stripe webhook confirms payment (or directly via session lookup as fallback).
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: email,
    metadata: { sentinel_tier: tier },
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: t.cents,
          product_data: {
            name: t.name,
            description: `One-time camera exposure audit · up to ${t.quota} assets · vendor-specific remediation report`,
          },
        },
        quantity: 1,
      },
    ],
    success_url: 'https://www.hyveapp.co/spy/app/sentinel/setup?session={CHECKOUT_SESSION_ID}',
    cancel_url: 'https://www.hyveapp.co/spy/app/sentinel?cancelled=1',
  })

  return NextResponse.json({ url: session.url })
}

export const dynamic = 'force-dynamic'
