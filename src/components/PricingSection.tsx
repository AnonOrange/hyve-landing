'use client'

import { useState } from 'react'

export default function PricingSection() {
  const [loading, setLoading] = useState<'monthly' | 'annual' | null>(null)
  const [monthlyHyveId, setMonthlyHyveId] = useState('')
  const [annualHyveId, setAnnualHyveId] = useState('')
  const [idError, setIdError] = useState('')
  const stripeEnabled = !!process.env.NEXT_PUBLIC_STRIPE_ENABLED

  function validateHyveId(id: string): boolean {
    const clean = id.trim().replace(/^@/, '')
    if (!clean || !/^[a-z0-9_]{3,32}$/i.test(clean)) {
      setIdError('Enter a valid HYVE ID (e.g. @username)')
      return false
    }
    setIdError('')
    return true
  }

  async function handleCheckout(plan: 'monthly' | 'annual') {
    const id = plan === 'monthly' ? monthlyHyveId : annualHyveId
    if (!validateHyveId(id)) return
    if (!stripeEnabled) return
    setLoading(plan)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, hyveId: id.trim() }),
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
            Text messaging is free. Subscribe for calls, media &amp; location sharing — no ads, no data harvesting.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Monthly */}
          <div className="hyve-card rounded-3xl p-10 md:p-14 flex flex-col">
            <p className="text-white/50 text-sm font-medium mb-3">Monthly</p>
            <div className="flex items-end gap-1 mb-6">
              <span className="text-6xl font-black gradient-gold">$5.99</span>
              <span className="text-white/40 mb-2 text-lg">/month</span>
            </div>
            <ul className="space-y-3 flex-1 mb-8">
              {proFeatures.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-white/70">
                  <span className="text-gold mt-0.5 flex-shrink-0">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <div className="mb-4">
              <input
                type="text"
                value={monthlyHyveId}
                onChange={(e) => setMonthlyHyveId(e.target.value)}
                placeholder="Your HYVE ID (e.g. @username)"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-gold/50 transition-colors"
              />
              {idError && loading === null && <p className="text-xs text-red-400 mt-1">{idError}</p>}
              <p className="text-xs text-white/30 mt-1">Required to activate Pro in the app</p>
            </div>
            <button
              onClick={() => handleCheckout('monthly')}
              disabled={loading !== null || !stripeEnabled}
              className="btn-outline px-6 py-4 rounded-2xl font-bold text-base w-full disabled:opacity-50"
            >
              {loading === 'monthly' ? 'Redirecting…' : 'Subscribe Monthly'}
            </button>
            <a
              href={process.env.NEXT_PUBLIC_APK_URL || '#download'}
              download
              className="block text-center text-xs text-white/30 hover:text-white/60 mt-3 transition-colors"
            >
              or download free (text messaging only) ↓
            </a>
          </div>

          {/* Annual */}
          <div className="hyve-card rounded-3xl p-10 md:p-14 flex flex-col relative gold-glow border border-gold/20">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <span className="px-5 py-1.5 rounded-full bg-gold text-black text-xs font-black tracking-wider uppercase">
                Best Value
              </span>
            </div>
            <p className="text-white/50 text-sm font-medium mb-3">Annual</p>
            <div className="flex items-end gap-1 mb-1">
              <span className="text-6xl font-black gradient-gold">$4.99</span>
              <span className="text-white/40 mb-2 text-lg">/month</span>
            </div>
            <p className="text-xs text-white/40 mb-6">Billed $59.88/year — save $12</p>
            <ul className="space-y-3 flex-1 mb-8">
              {proFeatures.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-white/70">
                  <span className="text-gold mt-0.5 flex-shrink-0">✓</span>
                  {f}
                </li>
              ))}
              <li className="flex items-start gap-3 text-sm text-gold font-semibold">
                <span className="mt-0.5 flex-shrink-0">✓</span>
                2 months free
              </li>
            </ul>
            <div className="mb-4">
              <input
                type="text"
                value={annualHyveId}
                onChange={(e) => setAnnualHyveId(e.target.value)}
                placeholder="Your HYVE ID (e.g. @username)"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-gold/50 transition-colors"
              />
              {idError && loading === null && <p className="text-xs text-red-400 mt-1">{idError}</p>}
              <p className="text-xs text-white/30 mt-1">Required to activate Pro in the app</p>
            </div>
            <button
              onClick={() => handleCheckout('annual')}
              disabled={loading !== null || !stripeEnabled}
              className="btn-primary px-6 py-4 rounded-2xl font-bold text-base w-full disabled:opacity-50"
            >
              {loading === 'annual' ? 'Redirecting…' : 'Subscribe Annually'}
            </button>
            <a
              href={process.env.NEXT_PUBLIC_APK_URL || '#download'}
              download
              className="block text-center text-xs text-white/30 hover:text-white/60 mt-3 transition-colors"
            >
              or download free (text messaging only) ↓
            </a>
          </div>
        </div>

        <p className="text-center text-xs text-white/30 mt-8">
          Cancel anytime · Secure payment via Stripe · Android 8.0+ required
        </p>
      </div>
    </section>
  )
}

const proFeatures = [
  'Full access to HYVE encrypted messaging',
  'End-to-end encrypted calls',
  'Live encrypted location sharing',
  'All future updates included',
  'No data collection, no ads',
]
