import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })
const SUPA_URL = process.env.SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY!

const TIER_QUOTA: Record<string, number> = { personal: 5, family: 20, business: 100 }

// Called from the setup wizard after Stripe redirects with session_id.
// Verifies the session is paid + idempotently creates a sentinel_audits row.
export async function POST(req: NextRequest) {
  const { sessionId } = await req.json().catch(() => ({}))
  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

  // Idempotent: if an audit already exists for this session_id, return it.
  const existingRes = await fetch(
    `${SUPA_URL}/rest/v1/sentinel_audits?stripe_session_id=eq.${encodeURIComponent(sessionId)}&select=*`,
    { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } },
  )
  if (existingRes.ok) {
    const rows = await existingRes.json()
    if (rows[0]) return NextResponse.json({ audit: rows[0] })
  }

  // Verify with Stripe + extract metadata
  const session = await stripe.checkout.sessions.retrieve(sessionId)
  if (session.payment_status !== 'paid') {
    return NextResponse.json({ error: 'session not paid', payment_status: session.payment_status }, { status: 402 })
  }
  const tier = (session.metadata?.sentinel_tier || 'personal').toString()
  const email = session.customer_email || session.customer_details?.email
  if (!email) return NextResponse.json({ error: 'email missing on session' }, { status: 400 })

  const auditRow = {
    user_email: email.toLowerCase(),
    stripe_session_id: sessionId,
    stripe_payment_intent: typeof session.payment_intent === 'string' ? session.payment_intent : null,
    tier,
    asset_quota: TIER_QUOTA[tier] || 5,
    amount_paid_cents: session.amount_total,
    status: 'paid',
  }

  const insertRes = await fetch(`${SUPA_URL}/rest/v1/sentinel_audits`, {
    method: 'POST',
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(auditRow),
  })
  if (!insertRes.ok) {
    return NextResponse.json({ error: await insertRes.text() }, { status: 502 })
  }
  const [audit] = await insertRes.json()
  return NextResponse.json({ audit })
}

export const dynamic = 'force-dynamic'
