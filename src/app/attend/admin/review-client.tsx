'use client'

import { useState } from 'react'

const btn = 'rounded px-3 py-1.5 text-xs font-bold transition disabled:opacity-50'

export default function ReviewClient({ eventId }: { eventId: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function decide(decision: 'approve' | 'reject') {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/attend/admin/events/${eventId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      })
      if (res.ok) {
        window.location.reload()
        return
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      setError(data.error ?? 'That decision could not be recorded')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          onClick={() => decide('approve')}
          disabled={busy}
          className={`${btn} bg-[#E8C456] text-black hover:brightness-110`}
        >
          Approve
        </button>
        <button
          onClick={() => decide('reject')}
          disabled={busy}
          className={`${btn} border border-[#2a2135] text-[#9e8a55] hover:text-red-400`}
        >
          Reject
        </button>
      </div>
      {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  )
}
