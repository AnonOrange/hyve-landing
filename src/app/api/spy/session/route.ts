import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import crypto from 'node:crypto'
import { Resend } from 'resend'

const stripeKey = process.env.STRIPE_SECRET_KEY
const resendKey = process.env.RESEND_API_KEY

/**
 * Confirms the Stripe checkout session and returns / generates an activation code.
 * Activation codes are deterministic from the Stripe customer + subscription so we
 * never need to store them server-side; the Hyve Spy backend validates by hash.
 */
export async function GET(req: NextRequest) {
  if (!stripeKey) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }
  const sessionId = req.nextUrl.searchParams.get('session_id')
  if (!sessionId) {
    return NextResponse.json({ error: 'session_id required' }, { status: 400 })
  }

  const stripe = new Stripe(stripeKey)
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer'],
    })
    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return NextResponse.json({ error: 'Checkout not completed' }, { status: 400 })
    }

    const sub = session.subscription as Stripe.Subscription | null
    const email = (session.customer_details?.email
      || session.customer_email
      || (session.customer as Stripe.Customer | null)?.email
      || ''
    ).toLowerCase()

    if (!email || !sub) {
      return NextResponse.json({ error: 'Subscription data missing' }, { status: 400 })
    }

    const activationCode = makeActivationCode(sub.id, email)
    const trialEnd = sub.trial_end ? sub.trial_end * 1000 : null

    // Best-effort send email (skip silently if Resend not configured)
    if (resendKey) {
      const resend = new Resend(resendKey)
      await resend.emails.send({
        from: 'Hyve Spy <hello@hyveapp.co>',
        to: email,
        subject: 'Welcome to Hyve Spy — Your Activation Code',
        html: welcomeEmailHtml(activationCode, trialEnd),
      }).catch((e) => console.error('[spy] email send failed:', e))
    }

    return NextResponse.json({ email, trialEnd, activationCode })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function makeActivationCode(subscriptionId: string, email: string): string {
  // Deterministic 16-char code: HMAC(SUB_SECRET, email|sub) → 8 bytes base32
  const secret = process.env.SPY_ACTIVATION_SECRET || 'change-me-in-production'
  const h = crypto.createHmac('sha256', secret).update(`${email}|${subscriptionId}`).digest()
  // Crockford base32 of first 10 bytes -> 16 chars
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
  let code = ''
  let bits = 0, value = 0
  for (let i = 0; i < 10; i++) {
    value = (value << 8) | h[i]
    bits += 8
    while (bits >= 5) {
      bits -= 5
      code += alphabet[(value >>> bits) & 31]
    }
  }
  return code.match(/.{4}/g)!.join('-')   // SPY-XXXX-XXXX-XXXX-XXXX style → 4×4
}

function welcomeEmailHtml(code: string, trialEndMs: number | null): string {
  const trialEndStr = trialEndMs ? new Date(trialEndMs).toUTCString() : 'in 72 hours'
  return `<!doctype html>
<html><body style="font-family:-apple-system,system-ui,sans-serif;background:#020D14;color:#E2E8F0;padding:40px 24px;">
<div style="max-width:560px;margin:auto;">
<h1 style="color:#00D4FF;font-size:28px;margin:0 0 8px;">Welcome to Hyve Spy</h1>
<p style="color:#94A3B8;font-size:14px;margin:0 0 32px;">Your 72-hour free trial is active. Cancel any time before it ends and you won't be charged.</p>
<div style="background:rgba(0,212,255,0.06);border:1px solid #00D4FF;border-radius:8px;padding:24px;margin-bottom:24px;">
  <p style="color:#00D4FF;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin:0 0 8px;">Your Activation Code</p>
  <p style="font-family:monospace;font-size:24px;color:white;margin:0;letter-spacing:2px;">${code}</p>
</div>
<p style="color:#94A3B8;font-size:14px;line-height:1.6;">
  1. Download Hyve Spy from <a href="https://hyveapp.co/spy#download" style="color:#00D4FF;">hyveapp.co/spy</a> (APK or Play Store)<br>
  2. Open the app → Settings → Activate<br>
  3. Paste the code above. Everything unlocks for your trial.
</p>
<p style="color:#64748B;font-size:12px;margin-top:32px;">
  Trial ends: ${trialEndStr}<br>
  After trial: $5.99/month, billed monthly. Cancel any time in your account.<br>
  Manage your subscription: <a href="https://hyveapp.co/spy/account" style="color:#00D4FF;">hyveapp.co/spy/account</a>
</p>
<p style="color:#475569;font-size:11px;margin-top:32px;border-top:1px solid #0D2235;padding-top:16px;">
  HYVE SPY · Real-Time Public Safety Intelligence<br>
  hello@hyveapp.co
</p>
</div></body></html>`
}
