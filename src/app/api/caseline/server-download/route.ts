// /api/caseline/server-download?key=HYVE-XXXX-XXXX-XXXX
//
// License-gated redirect to the CaseLine Server zip on the public
// releases repo. Anyone who hits the GitHub URL directly can still grab
// the zip, but the server itself requires a license-issued JWT secret
// before any workstation can register/sync — so the practical effect is
// the same as gating the download. This endpoint exists to:
//
//   (a) give paying customers a single click on /caseline/download
//       without ever needing to leave hyveapp.co
//   (b) log who pulled the server build (audit trail for support)
//
// Returns:
//   302 → GitHub Releases asset URL   on valid + active license
//   400                                missing / malformed key
//   403                                key invalid / expired / cancelled
//   503                                upstream license server down

import { NextRequest, NextResponse } from 'next/server'

// Where the server archive lives. Bump these in lockstep with each
// server release.
const SERVER_VERSION = 'v1.0.0'
const SERVER_ASSET  = 'caseline-server-1.0.0.zip'
const RELEASE_REPO  = 'AnonOrange/hyve-caseline-releases'

const KEY_PATTERN = /^HYVE-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key')?.trim().toUpperCase()
  if (!key) return NextResponse.json({ error: 'missing-key', message: 'Pass ?key=HYVE-XXXX-XXXX-XXXX' }, { status: 400 })
  if (!KEY_PATTERN.test(key)) return NextResponse.json({ error: 'malformed-key', message: 'Key format is HYVE-XXXX-XXXX-XXXX' }, { status: 400 })

  // Validate via the existing validate endpoint. We call it on the same
  // origin so it's a single internal hop — Vercel keeps everything in
  // one region.
  const origin = `https://${req.headers.get('host') ?? 'www.hyveapp.co'}`
  let validation: { valid: boolean; reason?: string; tier?: string; stripeStatus?: string }
  try {
    const res = await fetch(`${origin}/api/caseline/validate?key=${encodeURIComponent(key)}`, { cache: 'no-store' })
    if (!res.ok && res.status !== 200) {
      return NextResponse.json({ error: 'upstream', message: `License server returned ${res.status}` }, { status: 503 })
    }
    validation = await res.json()
  } catch (err) {
    console.error('[server-download] license lookup failed', err)
    return NextResponse.json({ error: 'upstream', message: 'Could not reach license server' }, { status: 503 })
  }

  if (!validation.valid) {
    return NextResponse.json({
      error: 'license-invalid',
      reason: validation.reason ?? 'unknown',
      tier: validation.tier,
      stripeStatus: validation.stripeStatus,
      message: humanReason(validation.reason, validation.stripeStatus),
    }, { status: 403 })
  }

  // Build the public GitHub Releases asset URL. Anyone with this URL
  // can download, but we don't expose it directly — only validated keys
  // get redirected to it.
  const assetUrl = `https://github.com/${RELEASE_REPO}/releases/download/${SERVER_VERSION}/${SERVER_ASSET}`

  // 302 so the user's browser follows the redirect and starts the
  // download immediately. Add Cache-Control: no-store so a leaked
  // intermediate proxy can't replay the redirect later when the
  // license might have expired.
  return NextResponse.redirect(assetUrl, {
    status: 302,
    headers: { 'Cache-Control': 'no-store' },
  })
}

function humanReason(reason?: string, stripeStatus?: string): string {
  if (reason === 'not-found') return 'License key not found.'
  if (reason === 'expired') return 'License has expired — renew at hyveapp.co/caseline/buy.'
  if (reason === 'stripe-status-canceled') return 'Subscription cancelled — renew to restore access.'
  if (reason === 'stripe-status-past_due') return 'Payment past due — update billing to restore access.'
  if (reason === 'stripe-status-unpaid') return 'Subscription unpaid — update billing to restore access.'
  if (stripeStatus) return `Subscription status: ${stripeStatus}`
  return reason ?? 'License invalid'
}
