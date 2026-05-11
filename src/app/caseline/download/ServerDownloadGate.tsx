// License-gated CaseLine Server download.
//
// Free users see the button but it asks for a license key first.
// Paid users:
//   1. Type / paste their HYVE-XXXX-XXXX-XXXX key
//   2. Hit DOWNLOAD SERVER — the form POSTs to /api/caseline/server-download
//   3. On valid + active license, the API returns 302 → GitHub Releases zip,
//      and the browser starts the download
//   4. On expired / cancelled / not-found, we surface the API's
//      human-readable error inline
//
// No mailto fallback. No "request build" stub. Either the key is valid
// and the download starts, or the user sees exactly why it didn't.

'use client'

import Link from 'next/link'
import { useState } from 'react'

const ACCENT = '#00B4D8'
const KEY_PATTERN = /^HYVE-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/

const LICENSE_KEY_STORE = 'caseline-co-app-license-v1'

export default function ServerDownloadGate() {
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState(() => {
    if (typeof window === 'undefined') return ''
    return window.localStorage.getItem(LICENSE_KEY_STORE) ?? ''
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function download() {
    setError(null)
    setSuccess(false)
    const k = key.trim().toUpperCase()
    if (!k) { setError('Enter your license key.'); return }
    if (!KEY_PATTERN.test(k)) { setError('Key format is HYVE-XXXX-XXXX-XXXX (12 letters/digits in 3 groups of 4).'); return }

    setBusy(true)
    try {
      // Hit the API. On 302 we want the browser to follow + start the
      // download; on 4xx/5xx we want to read the JSON body and show the
      // reason inline. fetch() with redirect:'manual' lets us peek at
      // the response — but Vercel's fetch handling of opaque-redirect
      // is annoying. Easier path: open a hidden iframe to the
      // license-checked URL. On valid license it 302s to the zip and
      // the browser triggers a download; on invalid it shows the JSON
      // in the iframe (which we don't see) but the parent page stays
      // intact, and we can detect failure via a separate fetch first.

      const probe = await fetch(`/api/caseline/server-download?key=${encodeURIComponent(k)}`, {
        method: 'GET',
        redirect: 'manual',
        cache: 'no-store',
      })
      // fetch with redirect:manual returns opaque-redirect for 3xx, type:'opaqueredirect'.
      // For non-redirects, .ok / .status tell us the truth.
      if (probe.type === 'opaqueredirect' || probe.status === 0) {
        // License OK — kick off the actual download by navigating an
        // anchor click (works on all browsers including iOS Safari).
        const a = document.createElement('a')
        a.href = `/api/caseline/server-download?key=${encodeURIComponent(k)}`
        a.rel = 'noopener'
        document.body.appendChild(a)
        a.click()
        a.remove()
        // Remember the key so subsequent visits can one-tap-download.
        try { window.localStorage.setItem(LICENSE_KEY_STORE, k) } catch { /* ignore */ }
        setSuccess(true)
      } else {
        const body = await probe.json().catch(() => ({} as { message?: string }))
        setError(body.message ?? `License check failed (HTTP ${probe.status}).`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded px-6 py-3 text-center font-mono text-xs font-bold tracking-[0.3em] text-black transition hover:scale-[1.02]"
        style={{ background: ACCENT, boxShadow: `0 0 16px ${ACCENT}77` }}
      >
        DOWNLOAD SERVER →
      </button>
    )
  }

  return (
    <div className="space-y-2">
      <input
        type="text"
        inputMode="text"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        maxLength={19}
        value={key}
        onChange={(e) => setKey(e.currentTarget.value.toUpperCase())}
        placeholder="HYVE-XXXX-XXXX-XXXX"
        className="w-full rounded border-2 px-4 py-2 font-mono text-sm tracking-[0.2em] text-[#ede8d8] outline-none transition"
        style={{ borderColor: '#2a2135', background: 'rgba(0,0,0,0.5)' }}
        onFocus={(e) => (e.currentTarget.style.borderColor = ACCENT)}
        onBlur={(e) => (e.currentTarget.style.borderColor = '#2a2135')}
      />
      <button
        type="button"
        onClick={() => void download()}
        disabled={busy}
        className="w-full rounded px-6 py-3 text-center font-mono text-xs font-bold tracking-[0.3em] text-black transition hover:scale-[1.02] disabled:cursor-wait disabled:opacity-60"
        style={{ background: ACCENT, boxShadow: `0 0 16px ${ACCENT}77` }}
      >
        {busy ? 'VERIFYING LICENSE…' : success ? 'DOWNLOAD STARTED ✓' : 'DOWNLOAD SERVER →'}
      </button>
      {error && (
        <p className="rounded border-2 px-3 py-2 text-xs text-red-200" style={{ borderColor: '#ef4444', background: 'rgba(239,68,68,0.08)' }}>
          {error}{' '}
          <Link href="/caseline/buy" className="font-bold underline-offset-4 hover:underline" style={{ color: ACCENT }}>
            Buy a license →
          </Link>
        </p>
      )}
      {!error && !success && (
        <p className="text-[10px] text-[#6b5e3a]">
          Server download is included with every CaseLine subscription. Don&rsquo;t have a key?{' '}
          <Link href="/caseline/buy" className="font-bold underline-offset-4 hover:underline" style={{ color: ACCENT }}>
            Buy at /caseline/buy →
          </Link>
        </p>
      )}
    </div>
  )
}
