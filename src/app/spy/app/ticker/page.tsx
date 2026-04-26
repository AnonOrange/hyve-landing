'use client'

// TICKER — National 911 Live Ticker.
//
// A scrolling Bloomberg-terminal-style bar of dispatched/breaking events,
// nationwide, in real time. Built from two live signals:
//
//   1. Listener-spike feeds — the top N feeds by current listener count are
//      treated as "active incidents". The location's name + agency become
//      the ticker label, with a category-tagged emoji for visual scan.
//
//   2. Recent crime incidents (last 6h) — surfaced with category emojis.
//      Every incident in the open-data feeds is a real dispatched call.
//
// The two streams are interleaved by recency. Below the marquee we render a
// full leaderboard so users can drill into any item.
//
// The "no one has ever seen this" angle: aggregating ALL US public-safety
// audio activity + ALL US open crime data into one continuous nationwide
// scroll. Every other ticker is for one city or one type. This is the country.

import { useEffect, useMemo, useState } from 'react'

const API = 'https://hyve-api.vercel.app'

type TickerItem = {
  id: string
  emoji: string
  label: string
  detail: string
  city: string
  state: string
  ageSec: number
  source: 'feed' | 'crime'
  href?: string
  accent: string
}

const FEED_TYPE_EMOJI: Record<string, string> = {
  police: '🚓', fire: '🚒', ems: '🚑',
  aviation: '✈️', marine: '🚢', other: '📡', weather: '🌪️',
}

const CRIME_EMOJI: Record<string, string> = {
  shooting: '🔫', homicide: '💀', assault: '👊', robbery: '💰',
  burglary: '🏚', vehicle_theft: '🚗', theft: '🛒', drug: '💊',
  vandalism: '🎨', arson: '🔥', fraud: '💳', sex_offense: '⚠️',
}

function ageLabel(sec: number): string {
  if (sec < 60) return `${sec}s ago`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  return `${Math.floor(sec / 86400)}d ago`
}

export default function TickerPage() {
  const [items, setItems] = useState<TickerItem[]>([])
  const [loading, setLoading] = useState(true)
  const [paused, setPaused] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetch(`${API}/feeds/trending?limit=200`).then((r) => r.json()).catch(() => []),
      fetch(`${API}/crime/incidents?limit=500`).then((r) => r.json()).catch(() => []),
    ])
      .then(([feedsRaw, crimeRaw]) => {
        if (cancelled) return
        const feeds: any[] = Array.isArray(feedsRaw) ? feedsRaw : feedsRaw?.feeds || []
        const crimes: any[] = Array.isArray(crimeRaw) ? crimeRaw : crimeRaw?.incidents || []

        // Top 50 most-listened-to feeds become live incident tickers.
        // Listener count is the proxy for "this is happening right now."
        const feedItems: TickerItem[] = feeds
          .filter((f) => (f.listeners || 0) >= 30)
          .slice(0, 50)
          .map((f): TickerItem => {
            const type = (f.type || f.feedType || 'other').toLowerCase()
            return {
              id: `f:${f.id || f.feedId}`,
              emoji: FEED_TYPE_EMOJI[type] || '📡',
              label: (f.name || f.displayName || 'Live').toUpperCase(),
              detail: `${(f.listeners || 0).toLocaleString()} listeners · ${type}`,
              city: f.county || '',
              state: f.state || '',
              ageSec: 0, // live = 0
              source: 'feed',
              href: `/spy/app/feed/${f.id || f.feedId}`,
              accent: type === 'fire' ? '#FF2D2D' : type === 'ems' ? '#F59E0B' : type === 'aviation' ? '#A855F7' : type === 'marine' ? '#3B82F6' : '#00D4FF',
            }
          })

        // Recent crime: last 100 sorted by recency
        const now = Date.now()
        const crimeItems: TickerItem[] = crimes
          .map((c): TickerItem | null => {
            const ts = c.occurred_at ? new Date(c.occurred_at).getTime() : 0
            if (!ts) return null
            const ageSec = Math.floor((now - ts) / 1000)
            if (ageSec > 24 * 3600) return null // 24h max
            const cat = (c.category || c.offense || '').toLowerCase().replace(/[\s-]/g, '_')
            return {
              id: `c:${c.id || `${ts}-${c.lat}`}`,
              emoji: CRIME_EMOJI[cat] || '🚨',
              label: (c.offense || c.category || 'INCIDENT').toUpperCase(),
              detail: c.address || c.description || '',
              city: c.city || '',
              state: c.state || '',
              ageSec,
              source: 'crime',
              accent: '#EF4444',
            }
          })
          .filter((x): x is TickerItem => !!x)
          .sort((a, b) => a.ageSec - b.ageSec)
          .slice(0, 80)

        // Interleave so the marquee mixes feeds + crime
        const merged: TickerItem[] = []
        const max = Math.max(feedItems.length, crimeItems.length)
        for (let i = 0; i < max; i++) {
          if (feedItems[i]) merged.push(feedItems[i])
          if (crimeItems[i]) merged.push(crimeItems[i])
        }
        setItems(merged)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [tick])

  // Auto-refresh every 30s — feeds + crime change frequently
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(i)
  }, [])

  // Marquee items repeat 2x for seamless infinite scroll
  const marquee = useMemo(() => [...items, ...items], [items])

  return (
    <main className="min-h-screen bg-[#020D14] pb-24 text-[#E2E8F0]">
      <div
        className="sticky top-0 z-20 border-b border-[#0D2235] bg-[#020D14]/95 backdrop-blur"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-base">🎙️</span>
            <div>
              <div className="text-[10px] font-black tracking-[0.4em] text-[#F59E0B]">TICKER</div>
              <div className="font-mono text-[10px] text-[#64748B]">
                {loading ? 'aggregating nation…' : `${items.length} live events · refresh 30s`}
              </div>
            </div>
          </div>
          <button
            onClick={() => setPaused((p) => !p)}
            className="rounded border border-[#0D2235] px-3 py-1 text-[10px] font-bold tracking-widest text-[#94A3B8]"
          >
            {paused ? '▶ RESUME' : '❚❚ PAUSE'}
          </button>
        </div>
      </div>

      {/* Marquee bar — Bloomberg-style horizontal scroll */}
      <div className="overflow-hidden border-b border-[#0D2235] bg-black/60">
        <div
          className="flex gap-6 whitespace-nowrap py-2.5 font-mono text-xs"
          style={{
            animation: paused ? 'none' : 'tickerScroll 240s linear infinite',
            animationPlayState: paused ? 'paused' : 'running',
          }}
        >
          {marquee.map((it, i) => (
            <a
              key={`${it.id}-${i}`}
              href={it.href}
              className="inline-flex items-center gap-1.5"
              style={{ color: it.accent }}
            >
              <span>{it.emoji}</span>
              <span className="font-bold">{it.label}</span>
              <span className="text-[#64748B]">·</span>
              <span className="text-[#94A3B8]">{[it.city, it.state].filter(Boolean).join(', ')}</span>
              <span className="text-[#64748B]">·</span>
              <span className="text-[#475569]">{it.source === 'feed' ? 'LIVE' : ageLabel(it.ageSec)}</span>
            </a>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes tickerScroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>

      {/* Full leaderboard below */}
      <div className="mx-auto max-w-5xl px-4 pt-6">
        <div className="mb-3 text-[10px] font-bold tracking-[0.3em] text-[#F59E0B]">FULL LEADERBOARD ({items.length})</div>
        <ul className="grid gap-1.5">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-center gap-3 rounded border border-[#0D2235] bg-black/30 px-3 py-2 transition hover:border-[#F59E0B]"
            >
              <span className="shrink-0 text-base">{it.emoji}</span>
              <div className="min-w-0 flex-1">
                <a href={it.href} className="block">
                  <div className="truncate text-xs font-bold" style={{ color: it.accent }}>
                    {it.label}
                  </div>
                  <div className="truncate font-mono text-[10px] text-[#94A3B8]">
                    {[it.city, it.state].filter(Boolean).join(', ')}
                    {it.detail ? ` · ${it.detail}` : ''}
                  </div>
                </a>
              </div>
              <div className="shrink-0 font-mono text-[10px] text-[#64748B]">
                {it.source === 'feed' ? '● LIVE' : ageLabel(it.ageSec)}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
