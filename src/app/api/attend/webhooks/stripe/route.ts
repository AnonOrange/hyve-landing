import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { attendStripe } from '@/lib/attend/payments/stripe'
import {
  recordWebhookEvent,
  isWebhookProcessed,
  markWebhookProcessed,
} from '@/lib/attend/payments/payments-repository'
import { fulfilRegistration } from '@/lib/attend/payments/registration-service'

export const runtime = 'nodejs'

const WEBHOOK_SECRET = process.env.STRIPE_ATTEND_WEBHOOK_SECRET

// HYVE Attend's own Stripe webhook — separate from the shared /api/stripe/webhook.
// Deduplicates on completion (not receipt), so a delivery whose handler fails
// returns 500, Stripe retries, and the retry re-runs the (idempotent) handler.
export async function POST(req: NextRequest) {
  if (!WEBHOOK_SECRET) {
    console.error('[attend webhook] STRIPE_ATTEND_WEBHOOK_SECRET not set')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  const rawBody = await req.text()
  const sig = req.headers.get('stripe-signature')

  let event: Stripe.Event
  try {
    event = attendStripe().webhooks.constructEvent(rawBody, sig!, WEBHOOK_SECRET)
  } catch (err) {
    console.error('[attend webhook] signature verification failed:', (err as Error).message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    if (await isWebhookProcessed(event.id)) {
      return NextResponse.json({ received: true, duplicate: true })
    }
    await recordWebhookEvent('STRIPE', event.id, event.type, event.data.object)

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.metadata?.attend_kind === 'registration') {
        await fulfilRegistration(session)
      }
    } else if (event.type === 'account.updated') {
      // Connect account-status sync is wired in Task 6 (needs connect-service).
    }

    await markWebhookProcessed(event.id)
    return NextResponse.json({ received: true })
  } catch (err) {
    // 500 → Stripe retries. The event was not marked processed, so the retry
    // re-runs the handler; fulfilRegistration and the RPC are both idempotent.
    console.error(`[attend webhook] handler error for ${event.type}:`, (err as Error).message)
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }
}
