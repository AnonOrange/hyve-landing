'use client'

import { useState } from 'react'
import type { EventRow } from '@/lib/attend/events/repository'

const inputClass =
  'rounded border border-[#2a2135] bg-[#08070a] px-3 py-2 text-sm text-[#ede8d8] outline-none focus:border-[#E8C456]'
const actionBtn =
  'self-start rounded bg-[#E8C456] px-4 py-2 text-sm font-bold text-black transition hover:brightness-110 disabled:opacity-50'

// A stored timestamp -> the YYYY-MM-DDTHH:mm a datetime-local input wants.
// Treated as wall-clock text, consistent with the create form, which stores
// the raw datetime-local string alongside a separate `timezone` field — so no
// timezone conversion happens on the way in or out.
const toLocalInput = (iso: string | null) => (iso ? iso.slice(0, 16) : '')
const fmt = (iso: string | null) => (iso ? iso.slice(0, 16).replace('T', ' ') : '—')

export default function EventDetailsPanel({
  event,
  editable,
}: {
  event: EventRow
  editable: boolean
}) {
  const [title, setTitle] = useState(event.title)
  const [description, setDescription] = useState(event.description ?? '')
  const [startsAt, setStartsAt] = useState(toLocalInput(event.starts_at))
  const [endsAt, setEndsAt] = useState(toLocalInput(event.ends_at))
  const [timezone, setTimezone] = useState(event.timezone)
  const [policyText, setPolicyText] = useState(event.policy_text ?? '')
  const [refundCutoff, setRefundCutoff] = useState(String(event.refund_cutoff_hours))
  const [transferCutoff, setTransferCutoff] = useState(String(event.transfer_cutoff_hours))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      // No `action` field: an actionless PATCH body is a draft-details edit.
      const res = await fetch(`/api/attend/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          starts_at: startsAt,
          ends_at: endsAt,
          timezone,
          policy_text: policyText,
          refund_cutoff_hours: Number(refundCutoff),
          transfer_cutoff_hours: Number(transferCutoff),
        }),
      })
      if (res.ok) {
        window.location.reload()
        return
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      setError(data.error ?? 'Failed to save the event details')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (!editable) {
    return (
      <section className="rounded border border-[#2a2135] bg-[#111111] px-4 py-4">
        <h2 className="text-xs font-black tracking-[0.2em] text-[#9e8a55]">EVENT DETAILS</h2>
        <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Field label="Title" value={event.title} />
          <Field label="Timezone" value={event.timezone} />
          <Field label="Starts" value={fmt(event.starts_at)} />
          <Field label="Ends" value={fmt(event.ends_at)} />
          <Field label="Refund cutoff" value={`${event.refund_cutoff_hours}h before start`} />
          <Field label="Transfer cutoff" value={`${event.transfer_cutoff_hours}h before start`} />
          <Field label="Description" value={event.description || '—'} wide />
          <Field label="Policy" value={event.policy_text || '—'} wide />
        </dl>
        <p className="mt-3 text-xs text-[#9e8a55]">Details are locked once setup begins.</p>
      </section>
    )
  }

  return (
    <section className="rounded border border-[#2a2135] bg-[#111111] px-4 py-4">
      <h2 className="text-xs font-black tracking-[0.2em] text-[#9e8a55]">EVENT DETAILS</h2>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      <form onSubmit={submit} className="mt-3 flex flex-col gap-3">
        <label className="text-xs text-[#9e8a55]">
          Title
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={`${inputClass} mt-1 w-full`}
          />
        </label>
        <label className="text-xs text-[#9e8a55]">
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={`${inputClass} mt-1 w-full`}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-[#9e8a55]">
            Starts
            <input
              required
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className={`${inputClass} mt-1 w-full`}
            />
          </label>
          <label className="text-xs text-[#9e8a55]">
            Ends
            <input
              required
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className={`${inputClass} mt-1 w-full`}
            />
          </label>
        </div>
        <label className="text-xs text-[#9e8a55]">
          Timezone
          <input
            required
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className={`${inputClass} mt-1 w-full`}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-[#9e8a55]">
            Refund cutoff (hours before start)
            <input
              required
              type="number"
              min="0"
              step="1"
              value={refundCutoff}
              onChange={(e) => setRefundCutoff(e.target.value)}
              className={`${inputClass} mt-1 w-full`}
            />
          </label>
          <label className="text-xs text-[#9e8a55]">
            Transfer cutoff (hours before start)
            <input
              required
              type="number"
              min="0"
              step="1"
              value={transferCutoff}
              onChange={(e) => setTransferCutoff(e.target.value)}
              className={`${inputClass} mt-1 w-full`}
            />
          </label>
        </div>
        <label className="text-xs text-[#9e8a55]">
          Policy text
          <textarea
            value={policyText}
            onChange={(e) => setPolicyText(e.target.value)}
            rows={3}
            className={`${inputClass} mt-1 w-full`}
          />
        </label>
        <button type="submit" disabled={busy} className={actionBtn}>
          {busy ? 'Saving…' : 'Save details'}
        </button>
      </form>
    </section>
  )
}

function Field({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <dt className="text-[10px] uppercase tracking-wider text-[#9e8a55]">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-[#ede8d8]">{value}</dd>
    </div>
  )
}
