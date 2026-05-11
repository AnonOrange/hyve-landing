// /api/caseline/validate — desktop client license check.
//
// The desktop CaseLine app polls this endpoint on startup (and periodically
// at runtime) to confirm a license key is still valid. Two backing stores:
//
//   1. STRIPE (paid licenses)   — license_key lives in subscription metadata
//                                  minted at /caseline/welcome.
//   2. SUPABASE (comp keys)     — admin-issued free keys for testers, demo
//                                  partners, internal QA. Issued via the
//                                  /admin/caseline-keys panel.
//
// Lookup order: Stripe first (fast path for paying customers), then
// Supabase fallthrough. Comp keys can be soft-revoked at any time from
// the admin UI — when that happens, this endpoint returns
//   { valid: false, reason: 'comp-revoked', softRevoked: true, ... }
// The desktop client uses `softRevoked` to show a banner but keep the
// in-session app usable until next cold start (Q3-c policy).
//
//   GET /api/caseline/validate?key=HYVE-XXXX-XXXX-XXXX
//
// Response (always 200 to make the desktop client's life easy — the `valid`
// boolean carries the meaning, the HTTP status is just "we received your
// request"):
//
//   { valid: true|false,
//     reason?: string,
//     tier?: '5'|'10'|'custom',
//     maxSeats?: number,
//     seatsUsed?: number,
//     expiresAt?: number | null,    // null for never-expires comp keys
//     stripeStatus?: string,
//     source?: 'stripe' | 'comp',   // tells the desktop where the key came from
//     softRevoked?: boolean,        // comp-revoke fired mid-session
//     revokedAt?: string,
//     revokedReason?: string,
//     label?: string }              // admin-provided comp label, e.g. "QA team"

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getCompKey, touchLastValidated } from '@/lib/admin/comp-keys'

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

  if (sub) {
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
      source: 'stripe',
    })
  }

  // Stripe miss → check the admin-issued comp-key table.
  const comp = await getCompKey(key)
  if (!comp) return json({ valid: false, reason: 'not-found' })

  if (comp.revoked_at) {
    // Soft-revoke (Q3-c): valid=false so cold-start is locked, but
    // softRevoked=true so the desktop's running session shows a banner
    // and keeps working until the user closes the app.
    return json({
      valid: false,
      reason: 'comp-revoked',
      softRevoked: true,
      tier: comp.tier,
      maxSeats: comp.max_seats,
      expiresAt: null,
      revokedAt: comp.revoked_at,
      revokedReason: comp.revoked_reason,
      label: comp.label,
      source: 'comp',
    })
  }

  // Active comp key — stamp last_validated_at fire-and-forget for the admin UI.
  touchLastValidated(comp.key)

  return json({
    valid: true,
    tier: comp.tier,
    maxSeats: comp.max_seats,
    seatsUsed: 0,
    expiresAt: null,                // comp keys never expire on their own
    label: comp.label,
    source: 'comp',
  })
}
