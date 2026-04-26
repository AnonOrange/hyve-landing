import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const SUPA_URL = process.env.SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY!
const WEBHOOK_SECRET = process.env.STRIPE_SENTINEL_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET

const TIER_QUOTA: Record<string, number> = { personal: 5, family: 20, business: 100 }
const PENTEST_QUOTA: Record<string, number> = { personal: 3, family: 10, business: 50 }

/**
 * Stripe webhook — fires on checkout.session.completed for Sentinel/Scout
 * payments. We use it to:
 *   1. Idempotently create the sentinel_audits row (in case the user closes
 *      the browser before the success_url redirects them to /setup)
 *   2. Trigger an email with the audit recovery URL
 *
 * The setup wizard's /api/spy/sentinel/activate endpoint is also idempotent
 * — same insertion logic. Whichever fires first wins; the other no-ops.
 */
export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  let event: Stripe.Event
  try {
    if (WEBHOOK_SECRET && sig) {
      event = stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET)
    } else {
      // Dev/test: parse without signature verification (NEVER use in prod)
      event = JSON.parse(body)
    }
  } catch (e: any) {
    return NextResponse.json({ error: `webhook signature failed: ${e.message}` }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    // Only handle Sentinel sessions (filter by metadata key)
    const tier = session.metadata?.sentinel_tier
    const scope = session.metadata?.sentinel_scope || 'cameras'
    if (!tier) return NextResponse.json({ ok: true, ignored: 'not a sentinel session' })

    const email = (session.customer_email || session.customer_details?.email || '').toLowerCase()
    if (!email) return NextResponse.json({ error: 'email missing' }, { status: 400 })

    // Idempotent insert
    const existingRes = await fetch(
      `${SUPA_URL}/rest/v1/sentinel_audits?stripe_session_id=eq.${encodeURIComponent(session.id)}&select=id`,
      { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } },
    )
    const existing = await existingRes.json()
    let auditId: string | null = existing[0]?.id ?? null

    if (!auditId) {
      const quota = scope === 'pentest' ? (PENTEST_QUOTA[tier] || 3) : (TIER_QUOTA[tier] || 5)
      const insertRes = await fetch(`${SUPA_URL}/rest/v1/sentinel_audits`, {
        method: 'POST',
        headers: {
          apikey: SUPA_KEY,
          Authorization: `Bearer ${SUPA_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          user_email: email,
          stripe_session_id: session.id,
          stripe_payment_intent: typeof session.payment_intent === 'string' ? session.payment_intent : null,
          tier,
          scope_type: scope,
          asset_quota: quota,
          amount_paid_cents: session.amount_total,
          status: 'paid',
        }),
      })
      const inserted = await insertRes.json()
      auditId = inserted[0]?.id
    }

    // Send confirmation email with the setup URL
    if (auditId) {
      await sendConfirmationEmail({
        to: email,
        scope,
        tier,
        amount: session.amount_total || 0,
        setupUrl: `https://www.hyveapp.co/spy/app/sentinel/setup?session=${session.id}`,
      }).catch((e) => console.error('[sentinel] email send failed', e))
    }
  }

  return NextResponse.json({ received: true })
}

async function sendConfirmationEmail(opts: {
  to: string
  scope: string
  tier: string
  amount: number
  setupUrl: string
}) {
  const RESEND_KEY = process.env.RESEND_API_KEY
  if (!RESEND_KEY) {
    // No email provider configured — log and skip. Setup URL is also returned
    // by the success_url redirect so the user gets to setup either way.
    console.warn('[sentinel] RESEND_API_KEY not set; skipping confirmation email')
    return
  }

  const productName = opts.scope === 'pentest' ? 'Scout Pen-Test Audit' : 'Sentinel Camera Audit'
  const dollars = (opts.amount / 100).toFixed(2)

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Hyve Sentinel <sentinel@hyveapp.co>',
      to: opts.to,
      subject: `Your ${productName} is ready to start`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0F172A">
          <h1 style="font-size:20px;margin:0 0 16px">Payment received — let's get your audit started.</h1>
          <p style="font-size:14px;line-height:1.5;color:#475569">
            Thanks for your purchase. Here's what's next:
          </p>
          <ol style="font-size:14px;line-height:1.7;color:#475569">
            <li>Click the button below to open your audit setup wizard.</li>
            <li>Sign the authorization agreement (typed name).</li>
            <li>Register the assets (domains, IPs, etc.) you want scanned.</li>
            <li>Hit "Start Scan" — your report is ready in ~30 seconds.</li>
          </ol>
          <div style="margin:32px 0">
            <a href="${opts.setupUrl}"
               style="display:inline-block;background:#A855F7;color:#020D14;padding:12px 24px;border-radius:8px;font-weight:bold;text-decoration:none;letter-spacing:0.1em;font-size:13px">
              START YOUR AUDIT →
            </a>
          </div>
          <p style="font-size:12px;color:#94A3B8;margin-top:32px;border-top:1px solid #E2E8F0;padding-top:16px">
            <strong>Receipt:</strong> ${productName} (${opts.tier}) · $${dollars}<br>
            <strong>Lost this email?</strong> Visit hyveapp.co/spy/app/sentinel and use the "Lost your audit URL?" form to email yourself the link.<br>
            <strong>Questions?</strong> Email <a href="mailto:support@hyveapp.co">support@hyveapp.co</a>
          </p>
        </div>
      `,
    }),
  })
}

export const dynamic = 'force-dynamic'
