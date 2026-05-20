'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { EventRow } from '@/lib/attend/events/repository'
import type { FeaturedEvent } from '@/lib/attend/promotion/promotion-service'

// Local UI label list — the codebase keeps these per-component (see
// creator-events-client.tsx, ticket-types-panel.tsx) rather than shared.
const SHOW_TYPES = [
  { value: 'HUMAN_LIVE_BROADCAST', label: 'Human live broadcast' },
  { value: 'FREE_EVENT', label: 'Free event' },
  { value: 'PRIVATE_EVENT', label: 'Private event' },
]
const showTypeLabel = (v: string) => SHOW_TYPES.find((t) => t.value === v)?.label ?? v

const fmtWhen = (iso: string | null) => (iso ? iso.slice(0, 16).replace('T', ' ') : 'Date TBA')

const filterPill = (active: boolean) =>
  'rounded-full px-3 py-1 text-xs font-bold tracking-wider transition ' +
  (active
    ? 'bg-[#E8C456] text-black'
    : 'border border-[#2a2135] text-[#9e8a55] hover:text-[#E8C456]')

export default function DiscoveryClient({
  featured,
  live,
  upcoming,
}: {
  featured: FeaturedEvent[]
  live: EventRow[]
  upcoming: EventRow[]
}) {
  const [filter, setFilter] = useState('ALL')

  // Fire one impression beacon per distinct featured set. The dependency is a
  // stable joined string, so a fresh `featured` array reference carrying the
  // same ids does not re-fire (and double-count) the beacon.
  const featuredIds = featured.map((f) => f.campaignId).join(',')
  useEffect(() => {
    if (!featuredIds) return
    fetch('/api/attend/promotion/impressions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignIds: featuredIds.split(',') }),
      keepalive: true,
    }).catch(() => {})
  }, [featuredIds])

  const apply = (events: EventRow[]) =>
    filter === 'ALL' ? events : events.filter((e) => e.show_type === filter)

  return (
    <div className="pb-10">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilter('ALL')} className={filterPill(filter === 'ALL')}>
          All
        </button>
        {SHOW_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setFilter(t.value)}
            className={filterPill(filter === t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {featured.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs font-black tracking-[0.2em] text-[#E8C456]">FEATURED</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((f) => (
              <Link
                key={f.campaignId}
                href={`/api/attend/promotion/${f.campaignId}/click?to=${f.event.slug}`}
                className="flex flex-col gap-2 rounded border border-[#E8C456] bg-[#15120c] p-4 transition hover:brightness-110"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#E8C456]">
                  Featured · {showTypeLabel(f.event.show_type)}
                </span>
                <span className="text-base font-black">
                  {f.headline ?? f.event.title}
                </span>
                <span className="font-mono text-[10px] tracking-widest text-[#9e8a55]">
                  {fmtWhen(f.event.starts_at)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <Section title="LIVE NOW" empty="No live events right now." events={apply(live)} live />
      <Section
        title="UPCOMING"
        empty="No upcoming events yet."
        events={apply(upcoming)}
        live={false}
      />
    </div>
  )
}

function Section({
  title,
  empty,
  events,
  live,
}: {
  title: string
  empty: string
  events: EventRow[]
  live: boolean
}) {
  return (
    <section className="mt-8">
      <h2 className="text-xs font-black tracking-[0.2em] text-[#9e8a55]">{title}</h2>
      {events.length === 0 ? (
        <p className="mt-3 text-sm text-[#9e8a55]">{empty}</p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((ev) => (
            <EventCard key={ev.id} ev={ev} live={live} />
          ))}
        </div>
      )}
    </section>
  )
}

function EventCard({ ev, live }: { ev: EventRow; live: boolean }) {
  return (
    <Link
      href={`/attend/events/${ev.slug}`}
      className="flex flex-col gap-2 rounded border border-[#2a2135] bg-[#111111] p-4 transition hover:border-[#E8C456]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#9e8a55]">
          {showTypeLabel(ev.show_type)}
        </span>
        {live ? (
          <span className="font-mono text-[10px] font-bold tracking-widest text-[#39FF14]">
            ● LIVE
          </span>
        ) : (
          <span className="font-mono text-[10px] tracking-widest text-[#9e8a55]">
            {fmtWhen(ev.starts_at)}
          </span>
        )}
      </div>
      <span className="text-base font-black">{ev.title}</span>
    </Link>
  )
}
