'use client'

// TICKER — Location-aware live emergency ticker.
//
// Bloomberg-style scrolling bar of dispatched/breaking events, scoped to
// the USER'S LOCATION. We ask for geolocation on mount; events are sorted
// by distance from the user and filtered to a radius they can adjust
// (10mi / 25mi / 50mi / 100mi / 250mi / NATION). Fallback if location is
// denied: nationwide mode (closest to old behavior).
//
// Sources fused per radius:
//   1. Scanner feeds within radius — sorted desc by listener count
//      (proxy for "this is happening right now"). No hard listener
//      threshold so quiet feeds still appear when a small town has no
//      bigger station nearby.
//   2. Crime incidents within radius — last 24h, sorted by recency.
//
// The marquee + leaderboard show distance per item so the user can see
// "shooting · 4 miles away · 12s ago" — exactly the kind of info you want
// from a hyperlocal ticker.

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
  lat?: number
  lng?: number
  distanceMi?: number // populated when user location is known
}

// Radius options shown as chips. NATION effectively disables the geo
// filter (5000mi covers everything in CONUS + Alaska + Hawaii + Caribbean).
const RADII = [10, 25, 50, 100, 250, 5000] as const
type Radius = (typeof RADII)[number]

function haversineMi([la1, lo1]: [number, number], [la2, lo2]: [number, number]) {
  const toR = (x: number) => (x * Math.PI) / 180
  const dLat = toR(la2 - la1)
  const dLng = toR(lo2 - lo1)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(la1)) * Math.cos(toR(la2)) * Math.sin(dLng / 2) ** 2
  return 2 * 3958.8 * Math.asin(Math.sqrt(h))
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
  // null = unknown (geolocation pending or denied → fallback to nationwide).
  const [userPos, setUserPos] = useState<[number, number] | null>(null)
  const [geoState, setGeoState] = useState<'pending' | 'granted' | 'denied'>('pending')
  const [radius, setRadius] = useState<Radius>(50)

  // Ask for geolocation once on mount. Don't block rendering on it — the
  // ticker still works in nationwide mode if the user denies permission.
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoState('denied')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setUserPos([p.coords.latitude, p.coords.longitude])
        setGeoState('granted')
      },
      () => setGeoState('denied'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    )
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    // Two independent fetches — render whichever comes back first instead
    // of blocking on Promise.all. Crime is heavier (~150ms + render), feeds
    // are lighter (~80ms). Showing the marquee partially-populated feels
    // more alive than a 200ms empty state.
    const buildFeedItems = (raw: any): TickerItem[] => {
      const feeds: any[] = Array.isArray(raw) ? raw : raw?.feeds || []
      // Carry geo fields through so we can radius-filter + distance-sort
      // after the user's location resolves. We don't pre-sort here —
      // that's done downstream once both fetches return + geo is known.
      return feeds
        .map((f): TickerItem | null => {
          const lat = f.lat ?? f.latitude
          const lng = f.lng ?? f.lon ?? f.longitude
          if (typeof lat !== 'number' || typeof lng !== 'number') return null
          const type = (f.type || f.feedType || 'other').toLowerCase()
          return {
            id: `f:${f.id || f.feedId}`,
            emoji: FEED_TYPE_EMOJI[type] || '📡',
            label: (f.name || f.displayName || 'Live').toUpperCase(),
            detail: `${(f.listeners || 0).toLocaleString()} listeners · ${type}`,
            city: f.county || '',
            state: f.state || '',
            ageSec: 0,
            source: 'feed',
            href: `/spy/app/feed/${f.id || f.feedId}`,
            accent: type === 'fire' ? '#FF2D2D' : type === 'ems' ? '#F59E0B' : type === 'aviation' ? '#A855F7' : type === 'marine' ? '#3B82F6' : '#00D4FF',
            lat,
            lng,
          }
        })
        .filter((x): x is TickerItem => !!x)
    }

    const buildCrimeItems = (raw: any): TickerItem[] => {
      const crimes: any[] = Array.isArray(raw) ? raw : raw?.incidents || []
      const now = Date.now()
      return crimes
        .map((c): TickerItem | null => {
          const ts = c.occurred_at ? new Date(c.occurred_at).getTime() : 0
          if (!ts) return null
          const ageSec = Math.floor((now - ts) / 1000)
          if (ageSec > 24 * 3600) return null
          const lat = c.lat ?? c.latitude
          const lng = c.lng ?? c.lon ?? c.longitude
          if (typeof lat !== 'number' || typeof lng !== 'number') return null
          const cat = (c.subcategory || c.category || '').toLowerCase().replace(/[\s-]/g, '_')
          return {
            id: `c:${c.id || `${ts}-${lat}`}`,
            emoji: CRIME_EMOJI[cat] || '🚨',
            label: (c.subcategory || c.category || 'INCIDENT').toUpperCase(),
            detail: c.description || '',
            city: c.city || '',
            state: '',
            ageSec,
            source: 'crime',
            accent: '#EF4444',
            lat,
            lng,
          }
        })
        .filter((x): x is TickerItem => !!x)
    }

    let feedItems: TickerItem[] = []
    let crimeItems: TickerItem[] = []
    let pending = 2

    const interleaveAndRender = () => {
      const merged: TickerItem[] = []
      const max = Math.max(feedItems.length, crimeItems.length)
      for (let i = 0; i < max; i++) {
        if (feedItems[i]) merged.push(feedItems[i])
        if (crimeItems[i]) merged.push(crimeItems[i])
      }
      if (!cancelled) setItems(merged)
    }

    // Use the Supabase-backed realtime cache via /api/realtime/*. Geo-filter
    // server-side when we have user location → tiny payload, fast load.
    const feedsParams = new URLSearchParams({ limit: '500' })
    const crimeParams = new URLSearchParams({ limit: '1000', since_hours: '24' })
    if (userPos) {
      feedsParams.set('lat', String(userPos[0]))
      feedsParams.set('lng', String(userPos[1]))
      feedsParams.set('radius_mi', String(radius))
      crimeParams.set('lat', String(userPos[0]))
      crimeParams.set('lng', String(userPos[1]))
      crimeParams.set('radius_mi', String(radius))
    }

    fetch(`/api/realtime/feeds?${feedsParams}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((raw) => {
        feedItems = buildFeedItems(raw)
        interleaveAndRender()
      })
      .catch(() => {})
      .finally(() => {
        pending--
        if (pending === 0 && !cancelled) setLoading(false)
      })

    fetch(`/api/realtime/crime?${crimeParams}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((raw) => {
        crimeItems = buildCrimeItems(raw)
        interleaveAndRender()
      })
      .catch(() => {})
      .finally(() => {
        pending--
        if (pending === 0 && !cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [tick])

  // Auto-refresh every 30s — feeds + crime change frequently
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(i)
  }, [])

  // Apply geo scope: when we have userPos, attach distance to each item,
  // filter to within radius, sort closest-first. Without geo we fall back
  // to "nationwide" mode (sort feeds by listeners desc, crimes by recency).
  const scoped = useMemo(() => {
    if (userPos) {
      const withDist = items
        .map((it) =>
          typeof it.lat === 'number' && typeof it.lng === 'number'
            ? { ...it, distanceMi: haversineMi(userPos, [it.lat, it.lng]) }
            : it,
        )
        .filter((it) => (it.distanceMi ?? Infinity) <= radius)
      // Sort: scanner feeds (live, distance 0 = closest), crime by closeness * recency
      withDist.sort((a, b) => (a.distanceMi || 0) - (b.distanceMi || 0))
      return withDist.slice(0, 140)
    }
    // Nationwide fallback: feeds first (top 60 by listeners), then crime (top 80 by recency)
    const feeds = items.filter((it) => it.source === 'feed').slice(0, 60)
    const crime = items.filter((it) => it.source === 'crime').sort((a, b) => a.ageSec - b.ageSec).slice(0, 80)
    const out: TickerItem[] = []
    const max = Math.max(feeds.length, crime.length)
    for (let i = 0; i < max; i++) {
      if (feeds[i]) out.push(feeds[i])
      if (crime[i]) out.push(crime[i])
    }
    return out
  }, [items, userPos, radius])

  // Marquee items repeat 2x for seamless infinite scroll
  const marquee = useMemo(() => [...scoped, ...scoped], [scoped])

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
                {loading
                  ? 'aggregating events…'
                  : geoState === 'pending'
                    ? `${scoped.length} events · waiting for location…`
                    : userPos
                      ? `${scoped.length} events within ${radius >= 5000 ? 'NATION' : `${radius}mi`}`
                      : `${scoped.length} events · NATIONWIDE (location denied)`}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {geoState === 'denied' && (
              <button
                onClick={() => {
                  setGeoState('pending')
                  navigator.geolocation?.getCurrentPosition(
                    (p) => { setUserPos([p.coords.latitude, p.coords.longitude]); setGeoState('granted') },
                    () => setGeoState('denied'),
                  )
                }}
                className="rounded border border-[#F59E0B] bg-[#F59E0B]/10 px-2 py-1 text-[9px] font-bold tracking-widest text-[#F59E0B]"
              >
                📍 LOCATE
              </button>
            )}
            <button
              onClick={() => setPaused((p) => !p)}
              className="rounded border border-[#0D2235] px-3 py-1 text-[10px] font-bold tracking-widest text-[#94A3B8]"
            >
              {paused ? '▶' : '❚❚'}
            </button>
          </div>
        </div>

        {/* Radius selector — only meaningful with geolocation */}
        {userPos && (
          <div className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 pb-3">
            {RADII.map((r) => {
              const active = radius === r
              const label = r >= 5000 ? 'NATION' : `${r}mi`
              return (
                <button
                  key={r}
                  onClick={() => setRadius(r)}
                  className="shrink-0 rounded border px-3 py-1 text-[10px] font-bold tracking-widest transition"
                  style={{
                    borderColor: active ? '#F59E0B' : '#0D2235',
                    background: active ? '#F59E0B1F' : 'transparent',
                    color: active ? '#F59E0B' : '#64748B',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        )}
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
              {typeof it.distanceMi === 'number' && (
                <>
                  <span className="text-[#64748B]">·</span>
                  <span className="text-[#22C55E]">{it.distanceMi < 1 ? '<1mi' : `${Math.round(it.distanceMi)}mi`}</span>
                </>
              )}
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
        <div className="mb-3 text-[10px] font-bold tracking-[0.3em] text-[#F59E0B]">
          {userPos ? `EVENTS NEAR YOU · ${radius >= 5000 ? 'NATION' : `${radius}MI`}` : 'NATIONWIDE EVENTS'} ({scoped.length})
        </div>
        <ul className="grid gap-1.5">
          {scoped.map((it) => (
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
              <div className="flex shrink-0 flex-col items-end gap-0.5 font-mono text-[10px]">
                {typeof it.distanceMi === 'number' && (
                  <span className="text-[#22C55E]">{it.distanceMi < 1 ? '<1mi' : `${Math.round(it.distanceMi)}mi`}</span>
                )}
                <span className="text-[#64748B]">{it.source === 'feed' ? '● LIVE' : ageLabel(it.ageSec)}</span>
              </div>
            </li>
          ))}
        </ul>
        {scoped.length === 0 && !loading && (
          <div className="rounded border border-[#0D2235] bg-black/30 px-4 py-8 text-center font-mono text-[11px] text-[#64748B]">
            No events within {radius}mi yet — try expanding the radius above, or wait for the next 30s refresh.
          </div>
        )}
      </div>
    </main>
  )
}
