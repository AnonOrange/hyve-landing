'use client'

import { useState } from 'react'

export default function PricingSection() {
  const [loading, setLoading] = useState<'monthly' | 'annual' | null>(null)
  const stripeEnabled = !!process.env.NEXT_PUBLIC_STRIPE_ENABLED
  const apkUrl = process.env.NEXT_PUBLIC_APK_URL || '#'

  async function handleCheckout(plan: 'monthly' | 'annual') {
    if (!stripeEnabled) {
      window.location.href = apkUrl
      return
    }
    setLoading(plan)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json() as { url?: string; error?: string }
      if (data.url) window.location.href = data.url
    } finally {
      setLoading(null)
    }
  }

  return (
    <section id="pricing" className="py-24 px-6">
      <div className="section-divider max-w-6xl mx-auto mb-24" />

      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-14">
          <span className="inline-block px-4 py-1.5 rounded-full border border-gold/30 bg-gold/5 text-gold text-xs font-semibold tracking-widest uppercase mb-6">
            Simple Pricing
          </span>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
            Own Your Privacy
          </h2>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            One price. Full access. No ads, no data harvesting — ever.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Monthly */}
          <div className="hyve-card rounded-3xl p-8 flex flex-col gap-6 relative">
            <div>
              <p className="text-white/50 text-sm font-medium mb-1">Monthly</p>
              <div className="flex items-end gap-1">
                <span className="text-5xl font-black gradient-gold">$5.99</span>
                <span className="text-white/40 mb-2">/month</span>
              </div>
            </div>
            <ul className="space-y-3 flex-1">
              {planFeatures.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-white/70">
                  <CheckIcon />
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleCheckout('monthly')}
              disabled={loading !== null}
              className="btn-outline px-6 py-3.5 rounded-2xl font-bold text-sm w-full disabled:opacity-50"
            >
              {loading === 'monthly' ? 'Redirecting…' : 'Subscribe Monthly'}
            </button>
          </div>

          {/* Annual — recommended */}
          <div className="hyve-card rounded-3xl p-8 flex flex-col gap-6 relative gold-glow border border-gold/20">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="px-4 py-1 rounded-full bg-gold text-black text-xs font-black tracking-wider uppercase">
                Best Value
              </span>
            </div>
            <div>
              <p className="text-white/50 text-sm font-medium mb-1">Annual</p>
              <div className="flex items-end gap-1">
                <span className="text-5xl font-black gradient-gold">$4.99</span>
                <span className="text-white/40 mb-2">/month</span>
              </div>
              <p className="text-xs text-white/40 mt-1">Billed $59.88/year — save $12</p>
            </div>
            <ul className="space-y-3 flex-1">
              {planFeatures.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-white/70">
                  <CheckIcon />
                  {f}
                </li>
              ))}
              <li className="flex items-center gap-2 text-sm text-gold font-semibold">
                <CheckIcon gold />
                2 months free
              </li>
            </ul>
            <button
              onClick={() => handleCheckout('annual')}
              disabled={loading !== null}
              className="btn-primary px-6 py-3.5 rounded-2xl font-bold text-sm w-full disabled:opacity-50"
            >
              {loading === 'annual' ? 'Redirecting…' : 'Subscribe Annually'}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-white/30 mt-8">
          Cancel anytime · Secure payment via Stripe · Android 8.0+ required
        </p>
      </div>
    </section>
  )
}

const planFeatures = [
  'Full access to HYVE encrypted messaging',
  'End-to-end encrypted calls',
  'Live encrypted location sharing',
  'All future updates included',
  'No data collection, no ads',
]

function CheckIcon({ gold }: { gold?: boolean }) {
  return (
    <svg
      className={`w-4 h-4 flex-shrink-0 ${gold ? 'text-gold' : 'text-neon'}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}
