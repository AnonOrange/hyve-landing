'use client'

import { useState } from 'react'
import { formatUsd, dollarsToCents } from '@/lib/attend/money'
import type { TicketTypeRow } from '@/lib/attend/ticketing/ticket-type-repository'

const inputClass =
  'rounded border border-[#2a2135] bg-[#08070a] px-3 py-2 text-sm text-[#ede8d8] outline-none focus:border-[#E8C456]'
const actionBtn =
  'rounded bg-[#E8C456] px-3 py-1.5 text-xs font-bold text-black transition hover:brightness-110 disabled:opacity-50'
const ghostBtn =
  'rounded border border-[#2a2135] px-3 py-1.5 text-xs font-bold text-[#9e8a55] transition hover:text-[#E8C456] disabled:opacity-50'

// UI labels for the ticket-type kinds the service accepts. Kept here (not
// imported from the service) to match the SHOW_TYPES pattern in
// creator-events-client.tsx — the service owns validation, the UI owns labels.
const TICKET_KINDS = [
  { value: 'GENERAL_ADMISSION', label: 'General admission' },
  { value: 'VIP', label: 'VIP' },
  { value: 'BACKSTAGE_QA', label: 'Backstage Q&A' },
  { value: 'REPLAY_ACCESS', label: 'Replay access' },
  { value: 'GROUP_PACK', label: 'Group pack' },
  { value: 'EARLY_BIRD', label: 'Early bird' },
  { value: 'PROMO_CODE', label: 'Promo code' },
  { value: 'COMPLIMENTARY', label: 'Complimentary' },
]

const kindLabel = (kind: string) => TICKET_KINDS.find((k) => k.value === kind)?.label ?? kind

export default function TicketTypesPanel({
  eventId,
  ticketTypes,
  editable,
}: {
  eventId: string
  ticketTypes: TicketTypeRow[]
  editable: boolean
}) {
  // editingId === null → the form is in "add" mode; otherwise it edits that tier.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [kind, setKind] = useState('GENERAL_ADMISSION')
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [maxPerOrder, setMaxPerOrder] = useState('10')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function resetForm() {
    setEditingId(null)
    setName('')
    setKind('GENERAL_ADMISSION')
    setPrice('')
    setQuantity('')
    setMaxPerOrder('10')
    setError(null)
  }

  function startEdit(tt: TicketTypeRow) {
    setEditingId(tt.id)
    setName(tt.name)
    setKind(tt.kind)
    setPrice((tt.price_cents / 100).toFixed(2))
    setQuantity(String(tt.quantity_total))
    setMaxPerOrder(String(tt.max_per_order))
    setError(null)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    let priceCents: number
    try {
      priceCents = dollarsToCents(price)
    } catch {
      setError('Enter a valid price, e.g. 25.00')
      return
    }
    const body = {
      name,
      kind,
      priceCents,
      quantityTotal: Number(quantity),
      maxPerOrder: Number(maxPerOrder),
    }
    setBusy(true)
    try {
      const res = editingId
        ? await fetch(`/api/attend/ticket-types/${editingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch(`/api/attend/events/${eventId}/ticket-types`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
      if (res.ok) {
        window.location.reload()
        return
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      setError(data.error ?? 'Failed to save the ticket type')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this ticket type?')) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/attend/ticket-types/${id}`, { method: 'DELETE' })
      if (res.ok) {
        window.location.reload()
        return
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      setError(data.error ?? 'Failed to delete the ticket type')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded border border-[#2a2135] bg-[#111111] px-4 py-4">
      <h2 className="text-xs font-black tracking-[0.2em] text-[#9e8a55]">TICKET TYPES</h2>

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      <ul className="mt-3 flex flex-col gap-2">
        {ticketTypes.length === 0 && (
          <li className="text-sm text-[#9e8a55]">
            No ticket types yet{editable ? ' — add your first tier below.' : '.'}
          </li>
        )}
        {ticketTypes.map((tt) => (
          <li
            key={tt.id}
            className={
              'flex items-center justify-between gap-3 rounded border px-3 py-2 ' +
              (editingId === tt.id ? 'border-[#E8C456]' : 'border-[#2a2135]')
            }
          >
            <div>
              <span className="text-sm font-bold">{tt.name}</span>
              <span className="ml-2 text-[10px] uppercase tracking-wider text-[#9e8a55]">
                {kindLabel(tt.kind)}
              </span>
              <p className="text-xs text-[#9e8a55]">
                {formatUsd(tt.price_cents)} · {tt.quantity_total} available · max{' '}
                {tt.max_per_order}/order
              </p>
            </div>
            {editable && (
              <div className="flex shrink-0 gap-2">
                <button onClick={() => startEdit(tt)} disabled={busy} className={ghostBtn}>
                  Edit
                </button>
                <button onClick={() => remove(tt.id)} disabled={busy} className={ghostBtn}>
                  Delete
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {editable ? (
        <form onSubmit={submit} className="mt-4 flex flex-col gap-2 border-t border-[#2a2135] pt-4">
          <h3 className="text-[11px] font-bold tracking-widest text-[#9e8a55]">
            {editingId ? 'EDIT TICKET TYPE' : 'ADD A TICKET TYPE'}
          </h3>
          <input
            required
            placeholder="Tier name (e.g. General Admission)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputClass}>
            {TICKET_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-3 gap-2">
            <label className="text-[11px] text-[#9e8a55]">
              Price (USD)
              <input
                required
                type="number"
                min="0"
                step="0.01"
                placeholder="25.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className={`${inputClass} mt-1 w-full`}
              />
            </label>
            <label className="text-[11px] text-[#9e8a55]">
              Quantity
              <input
                required
                type="number"
                min="0"
                step="1"
                placeholder="100"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={`${inputClass} mt-1 w-full`}
              />
            </label>
            <label className="text-[11px] text-[#9e8a55]">
              Max / order
              <input
                required
                type="number"
                min="1"
                step="1"
                value={maxPerOrder}
                onChange={(e) => setMaxPerOrder(e.target.value)}
                className={`${inputClass} mt-1 w-full`}
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className={actionBtn}>
              {busy ? 'Saving…' : editingId ? 'Save changes' : 'Add ticket type'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} disabled={busy} className={ghostBtn}>
                Cancel
              </button>
            )}
          </div>
        </form>
      ) : (
        <p className="mt-3 text-xs text-[#9e8a55]">Ticket types are locked once setup begins.</p>
      )}
    </section>
  )
}
