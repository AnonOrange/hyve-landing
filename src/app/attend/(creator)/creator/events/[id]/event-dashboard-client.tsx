'use client'

import Link from 'next/link'
import type { EventRow } from '@/lib/attend/events/repository'
import type { TicketTypeRow } from '@/lib/attend/ticketing/ticket-type-repository'

const card = 'rounded border border-[#2a2135] bg-[#111111] px-4 py-3'

// Skeleton header for the per-event creator dashboard. The setup-progress,
// event-details, and ticket-types panels plus the contextual action are
// composed in here in Phase 2c task 6.
export default function EventDashboardClient({
  event,
  ticketTypes,
  payoutsEnabled,
}: {
  event: EventRow
  ticketTypes: TicketTypeRow[]
  payoutsEnabled: boolean
}) {
  return (
    <div className="py-10">
      <Link
        href="/attend/creator"
        className="text-xs font-bold tracking-[0.2em] text-[#9e8a55] hover:text-[#E8C456]"
      >
        ← BACK TO EVENTS
      </Link>

      <div className="mt-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">{event.title}</h1>
          <p className="mt-1 text-xs tracking-widest text-[#9e8a55]">{event.show_type}</p>
        </div>
        <span className="font-mono text-[10px] tracking-widest text-[#E8C456]">{event.status}</span>
      </div>

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <div className={card}>
          <span className="text-xs text-[#9e8a55]">Ticket types</span>
          <p className="text-sm font-bold">{ticketTypes.length}</p>
        </div>
        <div className={card}>
          <span className="text-xs text-[#9e8a55]">Payouts</span>
          <p className="text-sm font-bold">{payoutsEnabled ? 'Connected' : 'Not connected'}</p>
        </div>
      </div>
    </div>
  )
}
