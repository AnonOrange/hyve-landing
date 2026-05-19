'use client'

import { useState } from 'react'
import Link from 'next/link'

const primaryBtn =
  'rounded bg-[#E8C456] px-4 py-2 text-sm font-bold text-black transition hover:brightness-110 disabled:opacity-50'

export default function ClaimClient({
  token,
  eventTitle,
  unavailable,
}: {
  token: string | null
  eventTitle: string | null
  unavailable: boolean
}) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needSignIn, setNeedSignIn] = useState(false)

  async function claim(body: { token?: string; friendCode?: string }) {
    setBusy(true)
    setError(null)
    setNeedSignIn(false)
    try {
      const res = await fetch('/api/attend/transfers/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        window.location.href = '/attend/wallet'
        return
      }
      if (res.status === 401) {
        setNeedSignIn(true)
        return
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      setError(data.error ?? 'This ticket could not be claimed')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="py-10">
      <h1 className="text-2xl font-black">Claim a ticket</h1>

      {token ? (
        unavailable ? (
          <p className="mt-4 text-sm text-[#9e8a55]">
            This transfer link is no longer valid — it may have been claimed, revoked, or
            expired.
          </p>
        ) : (
          <>
            <p className="mt-3 text-sm text-[#9e8a55]">
              You&apos;ve been sent a ticket{eventTitle ? ` to ${eventTitle}` : ''}.
            </p>
            <button
              onClick={() => claim({ token })}
              disabled={busy}
              className={`${primaryBtn} mt-4`}
            >
              {busy ? 'Claiming…' : 'Claim this ticket'}
            </button>
          </>
        )
      ) : (
        <>
          <p className="mt-3 text-sm text-[#9e8a55]">Enter the friend code you were given.</p>
          <div className="mt-3 flex gap-2">
            <input
              placeholder="HYVE-XXXX-XXXX"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="rounded border border-[#2a2135] bg-[#111111] px-3 py-2 font-mono text-sm uppercase text-[#ede8d8] outline-none focus:border-[#E8C456]"
            />
            <button
              onClick={() => claim({ friendCode: code.trim() })}
              disabled={busy || code.trim().length === 0}
              className={primaryBtn}
            >
              {busy ? 'Claiming…' : 'Claim'}
            </button>
          </div>
        </>
      )}

      {needSignIn && (
        <p className="mt-3 text-xs text-[#9e8a55]">
          Please{' '}
          <Link href="/attend/login" className="font-bold text-[#E8C456] hover:underline">
            sign in
          </Link>{' '}
          to claim this ticket, then return to this page.
        </p>
      )}
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </div>
  )
}
