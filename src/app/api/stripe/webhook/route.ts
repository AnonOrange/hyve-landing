import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supaPost } from '@/lib/supabase'

export const runtime = 'nodejs'

const WEBHOOK_SECRET = process.env.STRIPE_UMBRELLA_WEBHOOK_SECRET

// Price ID → product mapping
function priceIdToProduct(priceId: string): string {
  const {
    STRIPE_MONTHLY_PRICE_ID,
    STRIPE_ANNUAL_PRICE_ID,
    STRIPE_SPY_PRICE_ID,
    STRIPE_SPY_ANNUAL_PRICE_ID,
    STRIPE_SPY_PRO_PRICE_ID,
    STRIPE_SPY_PRO_ANNUAL_PRICE_ID,
  } = process.env

  if (priceId === STRIPE_MONTHLY_PRICE_ID || priceId === STRIPE_ANNUAL_PRICE_ID) return 'messenger'
  if (priceId === STRIPE_SPY_PRICE_ID || priceId === STRIPE_SPY_ANNUAL_PRICE_ID) return 'spy'
  if (priceId === STRIPE_SPY_PRO_PRICE_ID || priceId === STRIPE_SPY_PRO_ANNUAL_PRICE_ID) return 'spy_pro'
  return 'unknown'
}

function planLabel(priceId: string): string {
  const {
    STRIPE_MONTHLY_PRICE_ID, STRIPE_ANNUAL_PRICE_ID,
    STRIPE_SPY_PRICE_ID, STRIPE_SPY_ANNUAL_PRICE_ID,
    STRIPE_SPY_PRO_PRICE_ID, STRIPE_SPY_PRO_ANNUAL_PRICE_ID,
  } = process.env

  if (priceId === STRIPE_ANNUAL_PRICE_ID || priceId === STRIPE_SPY_ANNUAL_PRICE_ID || priceId === STRIPE_SPY_PRO_ANNUAL_PRICE_ID) return 'annual'
  if (priceId === STRIPE_MONTHLY_PRICE_ID || priceId === STRIPE_SPY_PRICE_ID || priceId === STRIPE_SPY_PRO_PRICE_ID) return 'monthly'
  return 'unknown'
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!WEBHOOK_SECRET) {
    console.error('[umbrella webhook] STRIPE_UMBRELLA_WEBHOOK_SECRET not set')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig!, WEBHOOK_SECRET)
  } catch (err) {
    console.error('[umbrella webhook] Signature verification failed:', (err as Error).message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Always return 200 — use idempotency constraints to prevent double-processing
  try {
    if (event.type === 'checkout.session.completed') {
      await handleCheckoutCompleted(stripe, event.data.object as Stripe.Checkout.Session)
    } else if (event.type === 'invoice.payment_failed') {
      await handlePaymentFailed(event.data.object as Stripe.Invoice)
    }
    // customer.subscription.deleted: snapshot cron will pick up the change within 5 min
  } catch (err) {
    console.error('[umbrella webhook] Handler error:', (err as Error).message)
    // Don't surface errors to Stripe — log only
  }

  return NextResponse.json({ received: true })
}

async function handleCheckoutCompleted(stripe: Stripe, session: Stripe.Checkout.Session): Promise<void> {
  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 })
  const firstItem = lineItems.data[0]
  const priceId = firstItem?.price?.id ?? ''
  const product = priceIdToProduct(priceId)
  const plan = planLabel(priceId)

  await supaPost('recent_purchases', {
    product,
    plan,
    amount: session.amount_total ?? 0,
    currency: session.currency ?? 'usd',
    customer_id: typeof session.customer === 'string' ? session.customer : (session.customer?.id ?? ''),
    hyve_id: (session.metadata?.hyve_id as string | undefined) ?? null,
    stripe_session: session.id,
  }, 'return=minimal')
  // ON CONFLICT DO NOTHING is enforced by UNIQUE(stripe_session) in the table
}

async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  await supaPost('failed_payments', {
    customer_id: typeof invoice.customer === 'string' ? invoice.customer : (invoice.customer?.id ?? ''),
    amount: invoice.amount_due ?? 0,
    reason: invoice.last_finalization_error?.message ?? 'payment_failed',
    stripe_event: invoice.id,
  }, 'return=minimal')
}
