'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type Status = {
  email?: string
  trialEnd?: number
  activationCode?: string
}

export default function WelcomeContent() {
  const params = useSearchParams()
  const sessionId = params.get('session_id')
  const [data, setData] = useState<Status | null>(null)
  const [error, setError] = useState('')
  const [cookieSet, setCookieSet] = useState(false)

  // Persist the Stripe session id so the PWA at /spy/app can verify entitlement
  // for ~1 year on this device. Middleware just checks presence; the
  // /api/spy/verify-session call inside the PWA confirms it's still live.
  useEffect(() => {
    if (!sessionId) return
    const secure = typeof window !== 'undefined' && window.location.protocol === 'https:'
    document.cookie =
      `hyve_spy_session=${encodeURIComponent(sessionId)}` +
      `; path=/; max-age=31536000; samesite=lax` +
      (secure ? '; secure' : '')
    setCookieSet(true)
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) return
    fetch(`/api/spy/session?session_id=${sessionId}`)
      .then((r) => r.json())
      .then((j) => (j.error ? setError(j.error) : setData(j)))
      .catch((e) => setError(String(e)))
  }, [sessionId])

  const apkUrl = process.env.NEXT_PUBLIC_SPY_APK_URL || '#'
  const playUrl = process.env.NEXT_PUBLIC_SPY_PLAY_URL || '#'

  return (
    <section className="min-h-screen flex items-center justify-center px-6 py-20">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-10">
          <span className="inline-block px-3 py-1 rounded border border-[#22C55E]/40 bg-[#22C55E]/5 text-[#22C55E] text-[10px] font-bold tracking-[0.2em] uppercase mb-6">
            ◆ Subscription Active
          </span>
          <h1 className="text-4xl md:text-5xl font-black mb-4">
            You&apos;re in.<br />
            <span className="text-[#00D4FF]">Spy is unlocked.</span>
          </h1>
          <p className="text-white/50 text-base">
            Welcome to Hyve Spy. Open the web app instantly, or install on Android / iPhone.
          </p>
        </div>

        {/* PWA CTA — gated by the cookie we just set */}
        <div className="bg-gradient-to-br from-[#00D4FF]/10 to-transparent border border-[#00D4FF]/40 rounded-xl p-6 md:p-8 mb-6 text-center">
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#00D4FF] mb-3">
            Web App · Works Anywhere
          </p>
          <a
            href="/spy/app"
            className="inline-block px-6 py-4 rounded-lg bg-[#00D4FF] text-black font-black uppercase tracking-wider text-sm hover:bg-white transition-colors"
          >
            Open Web App →
          </a>
          {cookieSet && (
            <p className="mt-3 text-[11px] text-[#22C55E]">
              Auto-logged-in on this device for 1 year.
            </p>
          )}
        </div>

        <div className="bg-black/40 border border-[#0D2235] rounded-xl p-6 md:p-8 mb-6">
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#00D4FF] mb-3">
            Your Activation Code
          </p>
          {error ? (
            <p className="text-[#FF2D2D] text-sm">{error}</p>
          ) : data?.activationCode ? (
            <>
              <p className="font-mono text-2xl md:text-3xl text-white tracking-widest break-all mb-3 bg-black/40 p-4 rounded border border-[#0D2235]">
                {data.activationCode}
              </p>
              <p className="text-[11px] text-white/40">
                Email sent to <span className="text-white/70 font-mono">{data.email}</span>. Open the
                Hyve Spy app → Settings → Activate → paste this code.
              </p>
            </>
          ) : (
            <p className="text-white/40 text-sm">Generating your activation code…</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          <a
            href={apkUrl}
            download
            className="px-5 py-4 rounded-lg bg-[#00D4FF] text-black font-bold uppercase tracking-wider text-sm text-center hover:bg-white transition-colors"
          >
            Download APK ↓
          </a>
          <a
            href={playUrl}
            target="_blank"
            rel="noopener"
            className="px-5 py-4 rounded-lg border border-[#0D2235] text-white/80 font-bold uppercase tracking-wider text-sm text-center hover:border-[#22C55E]/60 hover:text-white transition-colors"
          >
            Open Google Play ▶
          </a>
        </div>

        {/* iOS install instructions */}
        <div className="bg-black/40 border border-[#0D2235] rounded-xl p-6 mb-6">
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#A855F7] mb-3">
            iPhone · Install as Home-Screen App
          </p>
          <ol className="text-sm text-white/70 space-y-2 list-decimal list-inside">
            <li>
              Open <span className="font-mono text-white">hyveapp.co/spy/app</span> in Safari on your
              iPhone.
            </li>
            <li>
              Tap the <span className="font-bold text-white">Share</span> button (square with arrow
              up).
            </li>
            <li>
              Scroll and tap <span className="font-bold text-white">Add to Home Screen</span> →
              Add.
            </li>
          </ol>
          <p className="mt-4 text-[11px] text-white/50">
            After your first paid checkout you&apos;ll be auto-logged-in for 1 year on this device.
          </p>
        </div>

        <p className="text-center text-[11px] text-white/30 mt-8">
          Need help? Email{' '}
          <a href="mailto:hello@hyveapp.co" className="text-[#00D4FF] hover:underline">
            hello@hyveapp.co
          </a>
        </p>
      </div>
    </section>
  )
}
