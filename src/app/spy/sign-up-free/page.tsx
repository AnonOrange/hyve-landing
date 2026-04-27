'use client'

// Free-tier signup form. Posts to /api/spy/sign-up-free which creates
// a Supabase auth user + sets the `free:<userId>` session cookie.
//
// Once submitted successfully the user is redirected to /spy/app and
// lands directly into the free-tier experience with ads.

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

export default function SignUpFreePage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!agreed) {
      setError('You must accept the ads + terms to continue with the free tier')
      return
    }
    setSubmitting(true)
    try {
      const r = await fetch('/api/spy/sign-up-free', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data?.detail || data?.error || 'Sign-up failed')
      // Cookies are set on the response; navigate to the app.
      window.location.href = '/spy/app'
    } catch (e: any) {
      setError(e?.message || 'Sign-up failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#08070a] px-6 py-12 text-[#ede8d8]">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Image
            src="/spy-logo/hyve-spy-logo.png"
            alt="Hyve Spy"
            width={1536}
            height={1024}
            priority
            className="h-auto w-full max-w-xs"
          />
        </div>

        <div className="rounded-xl border border-[#2a2135] bg-black/40 p-6">
          <div className="mb-1 text-center font-mono text-[10px] tracking-[0.4em] text-[#22C55E]">
            FREE WITH ADS
          </div>
          <h1 className="text-center text-2xl font-black">Get the basics free</h1>
          <p className="mt-2 text-center text-[12px] leading-relaxed text-[#9e8a55]">
            Live scanner audio · 73K cameras · 39K TV channels · 54K radio stations · live crime ·
            push alerts. Same data the paid tiers get, with display ads on most screens.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 grid gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              autoComplete="email"
              className="rounded border border-[#2a2135] bg-black/60 px-3 py-2.5 text-sm text-white placeholder-[#475569] outline-none focus:border-[#22C55E]"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (8+ characters)"
              required
              minLength={8}
              autoComplete="new-password"
              className="rounded border border-[#2a2135] bg-black/60 px-3 py-2.5 text-sm text-white placeholder-[#475569] outline-none focus:border-[#22C55E]"
            />

            <label className="flex items-start gap-2 text-[11px] text-[#9e8a55]">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 accent-[#22C55E]"
              />
              <span>
                I understand the free tier shows display ads on most screens, and Pro features
                (Sleuth, Residential, Intel hub, Globe) require an upgrade. I accept the{' '}
                <Link href="/privacy" className="text-[#E8C456] underline-offset-4 hover:underline">privacy policy</Link>.
              </span>
            </label>

            {error && (
              <div className="rounded border border-[#FF2D2D]/40 bg-[#FF2D2D]/10 px-3 py-2 text-[11px] text-[#FF2D2D]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !agreed}
              className="mt-1 rounded bg-[#22C55E] py-3 text-sm font-black tracking-widest text-[#020D14] transition hover:bg-[#16A34A] disabled:opacity-50"
              style={{ boxShadow: '0 0 30px -10px rgba(34,197,94,0.5)' }}
            >
              {submitting ? 'CREATING ACCOUNT…' : 'START FREE — NO PAYMENT'}
            </button>
          </form>

          <div className="mt-5 border-t border-[#2a2135] pt-4 text-center">
            <p className="text-[11px] text-[#6b5e3a]">
              Want no ads? See{' '}
              <Link href="/spy#pricing" className="text-[#E8C456] underline-offset-4 hover:underline">
                paid tiers — $5.99/mo and up
              </Link>
            </p>
            <p className="mt-2 text-[11px] text-[#6b5e3a]">
              Already have an account?{' '}
              <Link href="/spy/login" className="text-[#E8C456] underline-offset-4 hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
