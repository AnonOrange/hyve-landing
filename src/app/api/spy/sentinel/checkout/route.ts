import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// Sentinel one-shot audit pricing — two products under one flow:
//   scope=cameras   → IP camera exposure audit (Hikvision/Dahua/Foscam/Axis/etc)
//   scope=pentest   → broader infrastructure pen test (DNS, SSL, ports, headers,
//                     subdomains, default-creds across common services)
// Both: pay once, sign authorization, register assets, get vendor-specific report.
const TIERS: Record<string, Record<string, { name: string; quota: number; cents: number }>> = {
  cameras: {
    personal: { name: 'Sentinel · Camera Audit (Personal)',  quota: 5,   cents:  999 },
    family:   { name: 'Sentinel · Camera Audit (Family)',    quota: 20,  cents: 1999 },
    business: { name: 'Sentinel · Camera Audit (Business)',  quota: 100, cents: 4999 },
  },
  pentest: {
    personal: { name: 'Scout · Pen Test (Personal)',         quota: 3,   cents: 4999 },
    family:   { name: 'Scout · Pen Test (Small Business)',   quota: 10,  cents: 9999 },
    business: { name: 'Scout · Pen Test (Enterprise)',       quota: 50,  cents: 29999 },
  },
}

export async function POST(req: NextRequest) {
  const { tier = 'personal', scope = 'cameras', email } = await req.json().catch(() => ({}))
  const t = TIERS[scope]?.[tier]
  if (!t) return NextResponse.json({ error: 'invalid tier or scope' }, { status: 400 })

  // Build checkout session — one-time payment mode, NOT subscription.
  // Success URL routes to the audit setup wizard with the session id, which
  // the wizard uses to create the sentinel_audits row server-side after the
  // Stripe webhook confirms payment (or directly via session lookup as fallback).
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: email,
    metadata: { sentinel_tier: tier, sentinel_scope: scope },
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: t.cents,
          product_data: {
            name: t.name,
            description: scope === 'pentest'
              ? `One-time infrastructure pen test · up to ${t.quota} assets · DNS / SSL / ports / headers / subdomain / default-creds checks · plain-English remediation report`
              : `One-time camera exposure audit · up to ${t.quota} assets · Hikvision/Dahua/Foscam/Axis vendor-specific remediation report`,
          },
        },
        quantity: 1,
      },
    ],
    success_url: 'https://www.hyveapp.co/spy/app/sentinel/setup?session={CHECKOUT_SESSION_ID}',
    cancel_url: 'https://www.hyveapp.co/spy/app/sentinel?cancelled=1',
  })

  return NextResponse.json({ url: session.url })
}

export const dynamic = 'force-dynamic'
