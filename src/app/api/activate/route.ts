import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripeKey  = process.env.STRIPE_SECRET_KEY
const hyveIdBase = process.env.HYVE_ID_BASE_URL || 'https://genuine-wisdom-production.up.railway.app'
const adminKey   = process.env.HYVE_ADMIN_KEY
const annualPriceId = process.env.STRIPE_ANNUAL_PRICE_ID

// Founders Lifetime Deal: annual subscribers before this date get permanent Pro
const FOUNDERS_DEADLINE = new Date('2026-06-16T23:59:59Z')

export async function POST(req: NextRequest) {
  if (!stripeKey || !adminKey) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }

  const { session_id, hyve_id } = await req.json() as { session_id?: string; hyve_id?: string }
  if (!session_id || !hyve_id) {
    return NextResponse.json({ error: 'session_id and hyve_id are required' }, { status: 400 })
  }

  const clean = hyve_id.trim().replace(/^@/, '').toLowerCase()
  if (!/^[a-z0-9_]{3,32}$/.test(clean)) {
    return NextResponse.json({ error: 'Invalid HYVE ID format' }, { status: 400 })
  }

  // Verify the Stripe session is actually paid
  const stripe = new Stripe(stripeKey)
  let paid = false
  let isAnnual = false
  try {
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['line_items'],
    })
    paid = session.payment_status === 'paid' || session.status === 'complete'
    // Check if any line item matches the annual price
    isAnnual = session.line_items?.data.some(
      (item) => item.price?.id === annualPriceId
    ) ?? false
  } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 400 })
  }

  if (!paid) {
    return NextResponse.json({ error: 'Payment not complete' }, { status: 402 })
  }

  // Founders Deal: annual payments before the deadline get lifetime Pro
  const isFoundersDeal = isAnnual && Date.now() < FOUNDERS_DEADLINE.getTime()
  const activateUrl = isFoundersDeal
    ? `${hyveIdBase}/v1/premium/${encodeURIComponent(clean)}?lifetime=1`
    : `${hyveIdBase}/v1/premium/${encodeURIComponent(clean)}`

  // Activate Pro (or Lifetime) on the HYVE-ID server
  try {
    const res = await fetch(activateUrl, {
      method: 'POST',
      headers: { 'x-hyve-admin-key': adminKey },
    })
    if (res.status === 404) {
      return NextResponse.json({ error: 'HYVE ID not found — please set up your account first' }, { status: 404 })
    }
    if (!res.ok) {
      return NextResponse.json({ error: 'Activation failed' }, { status: 502 })
    }
  } catch {
    return NextResponse.json({ error: 'Could not reach HYVE-ID server' }, { status: 503 })
  }

  return NextResponse.json({ ok: true, lifetime: isFoundersDeal })
}
