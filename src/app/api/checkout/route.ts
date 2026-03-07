import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripeKey = process.env.STRIPE_SECRET_KEY
const monthlyPriceId = process.env.STRIPE_MONTHLY_PRICE_ID
const annualPriceId = process.env.STRIPE_ANNUAL_PRICE_ID

export async function POST(req: NextRequest) {
  if (!stripeKey) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const stripe = new Stripe(stripeKey)
  const { plan } = await req.json() as { plan: 'monthly' | 'annual' }
  const priceId = plan === 'annual' ? annualPriceId : monthlyPriceId

  if (!priceId) {
    return NextResponse.json({ error: 'Price not configured' }, { status: 503 })
  }

  const origin = req.headers.get('origin') || 'https://hyveapp.co'

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/download?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/#pricing`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      subscription_data: {
        metadata: { product: 'hyve_app' },
      },
    })
    return NextResponse.json({ url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
