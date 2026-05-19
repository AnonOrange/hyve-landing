import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { attendStripe } from '@/lib/attend/payments/stripe'
import {
  claimWebhookEvent,
  isWebhookProcessed,
  releaseWebhookClaim,
  markWebhookProcessed,
} from '@/lib/attend/payments/payments-repository'
import { fulfilRegistration } from '@/lib/attend/payments/registration-service'
import { fulfilCheckout } from '@/lib/attend/payments/checkout-service'
import { syncAccountStatus } from '@/lib/attend/payments/connect-service'

export const runtime = 'nodejs'

const WEBHOOK_SECRET = process.env.STRIPE_ATTEND_WEBHOOK_SECRET

// HYVE Attend's own Stripe webhook — separate from the shared /api/stripe/webhook.
// Each event is claimed atomically (an INSERT against unique(provider_event_id));
// a handler that fails releases the claim and returns 500, so Stripe's retry
// re-runs the (idempotent) handler. Exactly-once in effect, retry-safe.
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

  // Atomically claim the event; a concurrent duplicate delivery loses the claim.
  let claimed: boolean
  try {
    claimed = await claimWebhookEvent('STRIPE', event.id, event.type, event.data.object)
  } catch (err) {
    console.error('[attend webhook] claim failed:', (err as Error).message)
    return NextResponse.json({ error: 'Webhook store unavailable' }, { status: 500 })
  }
  if (!claimed) {
    // Another delivery owns it: skip if already finished, else ask Stripe to
    // retry (by then the owner has finished, or released the claim on failure).
    if (await isWebhookProcessed(event.id)) {
      return NextResponse.json({ received: true, duplicate: true })
    }
    return NextResponse.json({ error: 'Event already in progress' }, { status: 500 })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.metadata?.attend_kind === 'registration') {
        await fulfilRegistration(session)
      } else if (session.metadata?.attend_kind === 'ticket_order') {
        await fulfilCheckout(session)
      }
    } else if (event.type === 'account.updated') {
      await syncAccountStatus((event.data.object as Stripe.Account).id)
    }
    await markWebhookProcessed(event.id)
    return NextResponse.json({ received: true })
  } catch (err) {
    // Release the claim so Stripe's retry re-runs the (idempotent) handler.
    await releaseWebhookClaim(event.id)
    console.error(`[attend webhook] handler error for ${event.type}:`, (err as Error).message)
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }
}
