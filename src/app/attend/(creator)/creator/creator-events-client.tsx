'use client'

import { useState } from 'react'
import type { EventRow } from '@/lib/attend/events/repository'

const inputClass =
  'rounded border border-[#2a2135] bg-[#111111] px-3 py-2 text-sm text-[#ede8d8] outline-none focus:border-[#E8C456]'

const SHOW_TYPES = [
  { value: 'HUMAN_LIVE_BROADCAST', label: 'Human live broadcast' },
  { value: 'FREE_EVENT', label: 'Free event' },
  { value: 'PRIVATE_EVENT', label: 'Private event' },
]

export default function CreatorEventsClient({ events }: { events: EventRow[] }) {
  const [title, setTitle] = useState('')
  const [showType, setShowType] = useState('HUMAN_LIVE_BROADCAST')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function createEvent(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const res = await fetch('/api/attend/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, showType, startsAt, endsAt, timezone }),
      })
      if (res.ok) {
        window.location.reload()
        return
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      setError(data.error ?? 'Failed to create the event')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="py-10">
      <h1 className="text-2xl font-black">Your events</h1>

      <ul className="mt-6 flex flex-col gap-2">
        {events.length === 0 && (
          <li className="text-sm text-[#9e8a55]">No events yet — create your first show below.</li>
        )}
        {events.map((ev) => (
          <li
            key={ev.id}
            className="flex items-center justify-between rounded border border-[#2a2135] bg-[#111111] px-4 py-3"
          >
            <span className="text-sm font-bold">{ev.title}</span>
            <span className="font-mono text-[10px] tracking-widest text-[#E8C456]">{ev.status}</span>
          </li>
        ))}
      </ul>

      <form onSubmit={createEvent} className="mt-10 flex max-w-md flex-col gap-3">
        <h2 className="text-sm font-black tracking-[0.2em] text-[#9e8a55]">CREATE A SHOW</h2>
        <input
          required
          placeholder="Event title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass}
        />
        <select value={showType} onChange={(e) => setShowType(e.target.value)} className={inputClass}>
          {SHOW_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <label className="text-xs text-[#9e8a55]">
          Starts
          <input
            type="datetime-local"
            required
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className={`${inputClass} mt-1 w-full`}
          />
        </label>
        <label className="text-xs text-[#9e8a55]">
          Ends
          <input
            type="datetime-local"
            required
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className={`${inputClass} mt-1 w-full`}
          />
        </label>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-[#E8C456] px-3 py-2 text-sm font-bold text-black transition hover:brightness-110 disabled:opacity-50"
        >
          {loading ? 'Creating…' : 'Create draft event'}
        </button>
      </form>
    </div>
  )
}
