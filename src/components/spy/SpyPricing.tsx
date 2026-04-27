'use client'

import { useState } from 'react'

export default function SpyPricing() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const stripeEnabled = !!process.env.NEXT_PUBLIC_STRIPE_ENABLED

  function validateEmail(e: string): boolean {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())) {
      setError('Enter a valid email address')
      return false
    }
    setError('')
    return true
  }

  async function handleStartTrial() {
    if (!validateEmail(email)) return
    if (!stripeEnabled) {
      setError('Checkout temporarily unavailable.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/spy/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (data.url) window.location.href = data.url
      else setError(data.error || 'Could not start checkout')
    } catch (e) {
      setError('Network error. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section id="pricing" className="border-b border-[#0D2235] py-24 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-[#00D4FF] text-[10px] font-bold tracking-[0.2em] uppercase">
            ── Pricing
          </span>
          <h2 className="text-4xl md:text-5xl font-black mt-3 mb-4">
            Use it free with ads.
            <br />
            <span className="text-white/50">Or pay $5.99/month — no ads.</span>
          </h2>
          <p className="text-white/50 text-base max-w-xl mx-auto">
            All scanner audio + cameras + crime + TV + radio — same data, ad-supported. Subscribe
            anytime to remove ads and unlock Pro features.
          </p>
        </div>

        <div className="bg-black/40 border border-[#00D4FF]/30 rounded-2xl p-8 md:p-12 relative overflow-hidden">
          {/* glow */}
          <div
            className="absolute -top-32 -right-32 w-64 h-64 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.18), transparent 70%)' }}
          />

          <div className="relative">
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2 py-1 bg-[#00D4FF] text-black text-[9px] font-black tracking-widest uppercase rounded">
                ad-free
              </span>
              <span className="px-2 py-1 border border-white/10 text-white/40 text-[9px] font-bold tracking-widest uppercase rounded">
                cancel anytime
              </span>
            </div>
            <p className="text-white/40 text-sm font-medium mb-2">Hyve Spy Premium</p>
            <div className="flex items-end gap-1 mb-8">
              <span className="text-7xl font-black font-mono text-[#00D4FF]">$5.99</span>
              <span className="text-white/40 mb-3 text-lg">/month</span>
            </div>

            <ul className="space-y-3 mb-8">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-white/80">
                  <span className="text-[#00D4FF] mt-0.5 flex-shrink-0">▸</span>
                  {f}
                </li>
              ))}
            </ul>

            <div className="mb-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full bg-black/60 border border-[#0D2235] focus:border-[#00D4FF]/60 rounded-lg px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none transition-colors font-mono"
              />
              {error && <p className="text-xs text-[#FF2D2D] mt-2">{error}</p>}
              <p className="text-[11px] text-white/30 mt-2">
                We&apos;ll email you the download link + activation code.
              </p>
            </div>

            <button
              onClick={handleStartTrial}
              disabled={loading || !stripeEnabled}
              className="w-full px-6 py-4 rounded-lg bg-[#00D4FF] text-black font-bold uppercase tracking-wider text-sm hover:bg-white transition-colors disabled:opacity-50"
            >
              {loading ? 'Redirecting to Checkout…' : 'Subscribe — Remove Ads'}
            </button>

            <p className="text-center text-[11px] text-white/30 mt-4">
              Or <a href="/spy/sign-up-free" className="text-[#00D4FF] hover:text-white">use the free tier with ads</a> — no payment required.
              <br />
              Secure payment via Stripe · Android 8.0+ · iOS coming soon
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

const features = [
  'Full access to all 4,335+ scanner feeds (police · fire · EMS · aviation · marine)',
  'Tap any of 25,000+ live cameras (DOT, USGS volcanoes, EarthCam, NPS, ski resorts)',
  'Real-time crime data overlay for 7 major US cities + FBI baseline for 200+',
  'FOIA request generator — fillable PDF for any incident, agency-specific',
  'Whisper STT auto-transcription, burst detection, listener-spike alerts',
  'Tactical dark map, US-bounded, OSM-licensed — works offline',
  'Push notifications for incidents in your area',
  'All future features included for the life of your subscription',
]
