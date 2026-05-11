// /api/caseline/validate — desktop client license check.
//
// The desktop CaseLine app polls this endpoint on startup (and periodically
// at runtime) to confirm a license key is still valid. Stripe is the source
// of truth — the license was minted by /caseline/welcome and stored on the
// subscription's metadata. Here we look it up via Stripe Search and report
// whether the subscription is still active and unexpired.
//
//   GET /api/caseline/validate?key=HYVE-XXXX-XXXX-XXXX
//
// Response (always 200 to make the desktop client's life easy — the `valid`
// boolean carries the meaning, the HTTP status is just "we received your
// request"):
//
//   { valid: true|false,
//     reason?: string,           // why it's invalid
//     tier?: '5'|'10',
//     maxSeats?: number,
//     seatsUsed?: number,
//     expiresAt?: number,        // ms epoch
//     stripeStatus?: string }    // e.g. 'active', 'past_due', 'canceled'

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripeKey = process.env.STRIPE_SECRET_KEY

// CORS — desktop app may call from a tauri:// or file:// origin in some cases.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders })
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

const KEY_PATTERN = /^HYVE-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key')?.trim().toUpperCase()
  if (!key) return json({ valid: false, reason: 'missing-key' }, 400)
  if (!KEY_PATTERN.test(key)) return json({ valid: false, reason: 'malformed-key' }, 400)
  if (!stripeKey) return json({ valid: false, reason: 'server-not-configured' }, 503)

  const stripe = new Stripe(stripeKey)

  // Stripe Search API supports metadata lookups. The license_key was
  // written to subscription.metadata by /caseline/welcome.
  let sub: Stripe.Subscription | undefined
  try {
    const result = await stripe.subscriptions.search({
      query: `metadata["license_key"]:"${key}"`,
      limit: 1,
    })
    sub = result.data[0]
  } catch (err) {
    console.error('[caseline/validate] stripe search failed', err)
    return json({ valid: false, reason: 'lookup-failed' }, 500)
  }

  if (!sub) return json({ valid: false, reason: 'not-found' })

  const tier = sub.metadata.tier === '10' ? '10' : '5'
  const maxSeats = tier === '10' ? 10 : 5
  const expiresAt = Number(sub.metadata.expires_at || 0) || (Date.now() + 365 * 24 * 60 * 60 * 1000)

  // Stripe's subscription status is authoritative — if the firm cancelled
  // or stopped paying, this flips before the metadata expires_at does.
  const stripeStatus = sub.status
  const stripeActive = stripeStatus === 'active' || stripeStatus === 'trialing'
  const notExpired = Date.now() < expiresAt

  return json({
    valid: stripeActive && notExpired,
    reason: !stripeActive ? `stripe-status-${stripeStatus}` : !notExpired ? 'expired' : undefined,
    tier,
    maxSeats,
    seatsUsed: 0, // Seat tracking is per-installation, handled by the seat-invites flow (separate PR)
    expiresAt,
    stripeStatus,
  })
}
