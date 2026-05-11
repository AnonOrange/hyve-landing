// BuyForm — captures firm name + email + tier, then POSTs to
// /api/caseline/checkout and forwards the user to Stripe Checkout.

'use client'

import { useState } from 'react'

const ACCENT = '#00B4D8'

type Tier = '5' | '10'

const TIERS: Array<{ id: Tier; name: string; price: string; seats: string; tagline: string }> = [
  { id: '5',  name: 'STARTER', price: '$999 / year',   seats: '5 seats',  tagline: 'Solo & small firms' },
  { id: '10', name: 'FIRM',    price: '$1,799 / year', seats: '10 seats', tagline: 'Mid-size firms' },
]

export default function BuyForm({ initialTier }: { initialTier: Tier }) {
  const [tier, setTier] = useState<Tier>(initialTier)
  const [firmName, setFirmName] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/caseline/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firmName, email, tier }),
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        throw new Error(data.error || `Checkout failed (${res.status})`)
      }
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Tier selector — radio cards */}
      <div>
        <div className="mb-3 font-mono text-[10px] tracking-[0.3em] text-[#9e8a55]">1 · CHOOSE A TIER</div>
        <div className="grid gap-3 sm:grid-cols-2">
          {TIERS.map((t) => {
            const selected = tier === t.id
            return (
              <label
                key={t.id}
                className="cursor-pointer rounded-xl border-2 p-5 transition"
                style={
                  selected
                    ? { borderColor: ACCENT, background: `${ACCENT}10`, boxShadow: `0 0 16px ${ACCENT}33` }
                    : { borderColor: '#2a2135', background: 'rgba(0,0,0,0.35)' }
                }
              >
                <input
                  type="radio"
                  name="tier"
                  value={t.id}
                  checked={selected}
                  onChange={() => setTier(t.id)}
                  className="sr-only"
                />
                <div className="font-mono text-[11px] tracking-[0.3em]" style={{ color: selected ? ACCENT : '#9e8a55' }}>
                  {t.name}
                </div>
                <div className="mt-2 text-2xl font-black text-[#ede8d8]">{t.price}</div>
                <div className="mt-0.5 font-mono text-[10px] tracking-[0.2em] text-[#9e8a55]">{t.seats}</div>
                <div className="mt-2 text-[11px] italic text-[#6b5e3a]">Best for: {t.tagline}</div>
              </label>
            )
          })}
        </div>
      </div>

      {/* Firm + email — text inputs */}
      <div>
        <div className="mb-3 font-mono text-[10px] tracking-[0.3em] text-[#9e8a55]">2 · FIRM DETAILS</div>
        <div className="space-y-3">
          <label className="block">
            <span className="block font-mono text-[10px] tracking-[0.2em] text-[#9e8a55]">FIRM NAME</span>
            <input
              type="text"
              required
              minLength={2}
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
              placeholder="Smith &amp; Associates LLP"
              className="mt-1 w-full rounded border-2 bg-black/40 px-4 py-3 font-mono text-sm text-[#ede8d8] outline-none transition"
              style={{ borderColor: '#2a2135' }}
              onFocus={(e) => (e.currentTarget.style.borderColor = ACCENT)}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#2a2135')}
            />
          </label>
          <label className="block">
            <span className="block font-mono text-[10px] tracking-[0.2em] text-[#9e8a55]">BILLING EMAIL</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@yourfirm.com"
              className="mt-1 w-full rounded border-2 bg-black/40 px-4 py-3 font-mono text-sm text-[#ede8d8] outline-none transition"
              style={{ borderColor: '#2a2135' }}
              onFocus={(e) => (e.currentTarget.style.borderColor = ACCENT)}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#2a2135')}
            />
            <span className="mt-1 block text-[10px] text-[#6b5e3a]">
              License key + receipt will be sent here.
            </span>
          </label>
        </div>
      </div>

      {error && (
        <div className="rounded border-2 border-red-500/50 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded px-7 py-4 font-mono text-sm font-bold tracking-[0.3em] text-black transition hover:scale-[1.01] disabled:cursor-wait disabled:opacity-60"
        style={{ background: ACCENT, boxShadow: `0 0 22px ${ACCENT}77` }}
      >
        {submitting ? 'REDIRECTING TO STRIPE…' : `CONTINUE TO PAYMENT →`}
      </button>
    </form>
  )
}
