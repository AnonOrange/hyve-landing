'use client'

import { useState } from 'react'

const btn = 'rounded px-3 py-1.5 text-xs font-bold transition disabled:opacity-50'

export default function DisputeActionClient({ disputeId }: { disputeId: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function act(action: 'submit' | 'accept') {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/attend/admin/disputes/${disputeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        window.location.reload()
        return
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      setError(data.error ?? 'That action could not be completed')
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
          onClick={() => act('submit')}
          disabled={busy}
          className={`${btn} bg-[#E8C456] text-black hover:brightness-110`}
        >
          Submit evidence
        </button>
        <button
          onClick={() => act('accept')}
          disabled={busy}
          className={`${btn} border border-[#2a2135] text-[#9e8a55] hover:text-red-400`}
        >
          Concede
        </button>
      </div>
      {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  )
}
