'use client'

import { useState } from 'react'
import type { PromotionDashboard } from '@/lib/attend/promotion/promotion-service'

const inputClass =
  'rounded border border-[#2a2135] bg-[#08070a] px-3 py-2 text-sm text-[#ede8d8] outline-none focus:border-[#E8C456]'

export default function PromotionClient({
  eventId,
  dashboard,
}: {
  eventId: string
  dashboard: PromotionDashboard
}) {
  const [headline, setHeadline] = useState(dashboard.headline)
  const [body, setBody] = useState(dashboard.body)
  const [approved, setApproved] = useState(dashboard.creativeApproved)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch(`/api/attend/creator/events/${eventId}/promotion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headline, body, approved }),
      })
      if (res.ok) {
        setSaved(true)
        return
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      setError(data.error ?? 'Could not save the creative')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      <section>
        <h2 className="text-xs font-black tracking-[0.2em] text-[#9e8a55]">AD CREATIVE</h2>
        <div className="mt-3 flex flex-col gap-2">
          <label className="text-xs text-[#9e8a55]">Headline</label>
          <input
            value={headline}
            onChange={(e) => {
              setHeadline(e.target.value)
              setSaved(false)
            }}
            className={inputClass}
          />
          <label className="mt-2 text-xs text-[#9e8a55]">Body</label>
          <textarea
            value={body}
            onChange={(e) => {
              setBody(e.target.value)
              setSaved(false)
            }}
            rows={3}
            className={inputClass}
          />
          <label className="mt-1 flex items-center gap-2 text-xs text-[#9e8a55]">
            <input
              type="checkbox"
              checked={approved}
              onChange={(e) => {
                setApproved(e.target.checked)
                setSaved(false)
              }}
            />
            Mark this creative as approved
          </label>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={busy}
              className="w-fit rounded bg-[#E8C456] px-4 py-1.5 text-xs font-bold text-black transition hover:brightness-110 disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save creative'}
            </button>
            {saved && <span className="text-xs text-green-400">Saved</span>}
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xs font-black tracking-[0.2em] text-[#9e8a55]">PERFORMANCE</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Impressions" value={dashboard.impressions.toLocaleString()} />
          <Stat label="Clicks" value={dashboard.clicks.toLocaleString()} />
          <Stat label="Tickets sold" value={dashboard.conversions.toLocaleString()} />
          <Stat label="Budget" value={`$${(dashboard.budgetCents / 100).toFixed(2)}`} />
        </div>
        <p className="mt-3 text-[11px] text-[#9e8a55]">
          Internal placements on HYVE run at no cost — your $
          {(dashboard.budgetCents / 100).toFixed(0)} budget is reserved for external ad
          campaigns as those integrations come online.
        </p>
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[#2a2135] bg-[#111111] px-3 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#9e8a55]">{label}</p>
      <p className="mt-1 text-lg font-black">{value}</p>
    </div>
  )
}
