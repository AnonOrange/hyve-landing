'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatUsd } from '@/lib/attend/money'
import type { TicketTypeRow } from '@/lib/attend/ticketing/ticket-type-repository'

const actionBtn =
  'rounded bg-[#E8C456] px-4 py-2 text-sm font-bold text-black transition hover:brightness-110 disabled:opacity-50'
const stepBtn =
  'h-7 w-7 rounded border border-[#2a2135] text-sm font-bold text-[#ede8d8] transition hover:border-[#E8C456] disabled:opacity-40'

// The ticket picker on the event page. Quantities are display-only here; the
// server re-prices the selection authoritatively in startCheckout.
export default function CheckoutClient({
  eventId,
  ticketTypes,
  signedIn,
}: {
  eventId: string
  ticketTypes: TicketTypeRow[]
  signedIn: boolean
}) {
  const [qty, setQty] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setQuantity(tt: TicketTypeRow, next: number) {
    setQty((q) => ({ ...q, [tt.id]: Math.max(0, Math.min(next, tt.max_per_order)) }))
  }

  const buyable = ticketTypes.filter((t) => t.status === 'ACTIVE')
  const selected = buyable
    .map((tt) => ({ tt, quantity: qty[tt.id] ?? 0 }))
    .filter((r) => r.quantity > 0)
  const totalCents = selected.reduce((sum, r) => sum + r.quantity * r.tt.price_cents, 0)

  async function checkout() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/attend/events/${eventId}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: selected.map((r) => ({ ticketTypeId: r.tt.id, quantity: r.quantity })),
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
      if (data.url) {
        window.location.href = data.url
        return
      }
      setError(data.error ?? 'Checkout could not be started')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded border border-[#2a2135] bg-[#111111] px-4 py-4">
      <h2 className="text-xs font-black tracking-[0.2em] text-[#9e8a55]">TICKETS</h2>

      {ticketTypes.length === 0 ? (
        <p className="mt-3 text-sm text-[#9e8a55]">Tickets not yet listed.</p>
      ) : (
        <>
          <ul className="mt-3 flex flex-col gap-2">
            {ticketTypes.map((tt) => {
              const active = tt.status === 'ACTIVE'
              const n = qty[tt.id] ?? 0
              return (
                <li
                  key={tt.id}
                  className="flex items-center justify-between gap-3 rounded border border-[#2a2135] px-3 py-2"
                >
                  <div>
                    <span className="text-sm font-bold">{tt.name}</span>
                    <p className="font-mono text-xs text-[#E8C456]">
                      {formatUsd(tt.price_cents)}
                    </p>
                  </div>
                  {active ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setQuantity(tt, n - 1)}
                        disabled={busy || n === 0}
                        className={stepBtn}
                        aria-label={`Remove one ${tt.name}`}
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm font-bold">{n}</span>
                      <button
                        type="button"
                        onClick={() => setQuantity(tt, n + 1)}
                        disabled={busy || n >= tt.max_per_order}
                        className={stepBtn}
                        aria-label={`Add one ${tt.name}`}
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#9e8a55]">
                      {tt.status === 'SOLD_OUT' ? 'Sold out' : 'Not on sale'}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>

          {buyable.length > 0 ? (
            <>
              <div className="mt-3 flex items-center justify-between border-t border-[#2a2135] pt-3">
                <span className="text-xs text-[#9e8a55]">Total</span>
                <span className="font-mono text-lg font-black text-[#E8C456]">
                  {formatUsd(totalCents)}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[#9e8a55]">
                All prices are final — no fees are added at checkout.
              </p>

              {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

              {signedIn ? (
                <button
                  type="button"
                  onClick={checkout}
                  disabled={busy || selected.length === 0}
                  className={`${actionBtn} mt-3 w-full`}
                >
                  {busy ? 'Starting checkout…' : 'Get tickets'}
                </button>
              ) : (
                <Link href="/attend/login" className={`${actionBtn} mt-3 block text-center`}>
                  Sign in to get tickets
                </Link>
              )}
            </>
          ) : (
            <p className="mt-3 text-sm text-[#9e8a55]">Tickets are not on sale right now.</p>
          )}
        </>
      )}
    </section>
  )
}
