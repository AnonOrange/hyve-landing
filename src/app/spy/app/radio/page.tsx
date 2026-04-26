'use client'

// Radio tab — radio.garden-inspired global map of free internet radio
// stations. Uses the open radio-browser.info community API (~50k stations
// with stream URLs, country codes, sometimes precise lat/lng).
//
// Why this beats radio.garden as a clone target:
//   - radio.garden's data is closed-source; radio-browser.info is CC-BY-SA.
//   - We get programmatic access to filter by country/tag/language.
//   - We don't have to scrape or pay for an API key.
//
// API usage notes:
//   - radio-browser.info is a federation of mirrors. Pick one round-robin.
//   - Send a User-Agent (their rule) — they'll rate-limit anonymous clients.
//   - We bound to ~5,000 most-clicked stations to keep the page fast; the
//     long tail of obscure stations adds little but lots of latency.

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { centroidFor, jitterCentroid } from '@/lib/countryCentroids'
import RadioOverlay from './RadioOverlay'

const RadioMap = dynamic(() => import('./RadioMap'), { ssr: false })

export type RadioStation = {
  id: string
  name: string
  country: string
  countryCode: string
  language: string
  tags: string[]
  lat: number
  lng: number
  streamUrl: string
  homepage: string
  favicon: string
  bitrate: number
  codec: string
  votes: number
  clickCount: number
}

// We hit the round-robin DNS, which Cloudflare-loadbalances to a healthy mirror
const RB_BASE = 'https://de1.api.radio-browser.info'

// Two endpoints, fetched in parallel and deduped:
//   - topclick/5000: most-clicked stations globally (covers every recognizable
//     international station without the long-tail bloat of all 54k entries)
//   - bycountrycodeexact/US: every working US station (~7,000) so domestic
//     coverage is complete — no missing local AM/FM affiliates.
const URL_TOP = `${RB_BASE}/json/stations/topclick/5000`
const URL_US = `${RB_BASE}/json/stations/bycountrycodeexact/US?hidebroken=true&order=clickcount&reverse=true`

export default function RadioPage() {
  const [stations, setStations] = useState<RadioStation[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [tagFilter, setTagFilter] = useState<string>('all')
  const [selected, setSelected] = useState<RadioStation | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch(URL_TOP, { headers: { 'User-Agent': 'HyveSpy/1.0 (+https://www.hyveapp.co)' } })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`top HTTP ${r.status}`)))),
      fetch(URL_US, { headers: { 'User-Agent': 'HyveSpy/1.0 (+https://www.hyveapp.co)' } })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`US HTTP ${r.status}`)))),
    ])
      .then(([topData, usData]: [any[], any[]]) => {
        if (cancelled) return
        // Dedup by stationuuid — overlap of top-clicked and US is significant.
        const merged = new Map<string, any>()
        for (const s of topData) if (s.stationuuid) merged.set(s.stationuuid, s)
        for (const s of usData) if (s.stationuuid) merged.set(s.stationuuid, s)
        const data = [...merged.values()]
        const out: RadioStation[] = []
        for (const s of data) {
          if (!s.url_resolved && !s.url) continue
          if (s.lastcheckok === 0) continue // dead stream
          const cc = (s.countrycode || '').toUpperCase()
          // Use precise geo if station provides it, else country centroid
          let lat: number | null = parseFloat(s.geo_lat)
          let lng: number | null = parseFloat(s.geo_long)
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            const cent = centroidFor(cc)
            if (!cent) continue
            const jitter = jitterCentroid(cent, s.stationuuid)
            lat = jitter[0]
            lng = jitter[1]
          }
          out.push({
            id: s.stationuuid,
            name: s.name?.trim() || 'Unknown',
            country: s.country || cc,
            countryCode: cc,
            language: (s.language || '').split(',')[0]?.trim() || '',
            tags: (s.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean),
            lat: lat as number,
            lng: lng as number,
            streamUrl: s.url_resolved || s.url,
            homepage: s.homepage || '',
            favicon: s.favicon || '',
            bitrate: s.bitrate || 0,
            codec: (s.codec || '').toUpperCase(),
            votes: s.votes || 0,
            clickCount: s.clickcount || 0,
          })
        }
        setStations(out)
      })
      .catch((e) => !cancelled && setErr(e?.message || 'Load failed'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  // Most-common 12 tags surfaced as quick-filter chips. radio-browser tags
  // are a free-text mess (~50k unique strings) but a Pareto count gives a
  // useful filter UX without enumerating all of them.
  const popularTags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of stations) for (const t of s.tags) counts.set(t, (counts.get(t) || 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t]) => t)
  }, [stations])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return stations.filter((s) => {
      if (tagFilter !== 'all' && !s.tags.includes(tagFilter)) return false
      if (q && !s.name.toLowerCase().includes(q) && !s.country.toLowerCase().includes(q)) return false
      return true
    })
  }, [stations, tagFilter, query])

  // Notify radio-browser when a station gets clicked — drives their
  // popularity ranking. Fire-and-forget, no error handling needed.
  const reportClick = (s: RadioStation) => {
    fetch(`${RB_BASE}/json/url/${s.id}`).catch(() => {})
  }

  return (
    <main className="relative h-screen w-full bg-[#020D14] text-[#E2E8F0]">
      <div
        className="absolute inset-x-0 top-0 z-[1000] border-b border-[#0D2235] bg-[#020D14]/95 backdrop-blur"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-base">📻</span>
            <div>
              <div className="text-[10px] font-black tracking-[0.4em] text-[#22C55E]">RADIO LIVE</div>
              <div className="font-mono text-[10px] text-[#64748B]">
                {loading ? 'loading radio-browser…' : `${visible.length.toLocaleString()} stations across ${new Set(visible.map((s) => s.countryCode)).size} countries`}
              </div>
            </div>
          </div>
        </div>
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 pb-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Station, country, genre…"
            className="flex-1 rounded border border-[#0D2235] bg-black/60 px-3 py-1.5 text-xs text-white placeholder-[#334155] outline-none focus:border-[#22C55E]"
          />
        </div>
        <div className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 pb-3">
          <button
            onClick={() => setTagFilter('all')}
            className="shrink-0 rounded border px-3 py-1 text-[10px] font-bold tracking-widest transition"
            style={{
              borderColor: tagFilter === 'all' ? '#22C55E' : '#0D2235',
              background: tagFilter === 'all' ? '#22C55E1F' : 'transparent',
              color: tagFilter === 'all' ? '#22C55E' : '#64748B',
            }}
          >
            ALL
          </button>
          {popularTags.map((t) => {
            const active = tagFilter === t
            return (
              <button
                key={t}
                onClick={() => setTagFilter(t)}
                className="shrink-0 rounded border px-3 py-1 text-[10px] font-bold tracking-widest transition"
                style={{
                  borderColor: active ? '#22C55E' : '#0D2235',
                  background: active ? '#22C55E1F' : 'transparent',
                  color: active ? '#22C55E' : '#64748B',
                }}
              >
                {t.toUpperCase()}
              </button>
            )
          })}
        </div>
      </div>

      {err && (
        <div className="absolute left-1/2 top-32 z-[1000] -translate-x-1/2 rounded bg-red-900/80 px-3 py-1.5 text-xs text-white">
          {err}
        </div>
      )}

      <RadioMap
        stations={visible}
        onPick={(s) => {
          reportClick(s)
          setSelected(s)
        }}
      />

      {selected && <RadioOverlay station={selected} onClose={() => setSelected(null)} />}
    </main>
  )
}
