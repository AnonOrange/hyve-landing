'use client'

// TV tab — every free public TV/broadcast stream we can reach, plotted at
// its real geographic location.
//
// Data sources combined:
//   1. Curated catalog (src/lib/liveBroadcasts.ts) — hand-picked YouTube Live
//      streams (NBC, BBC, NHK, NASA, etc.) with broadcaster HQ coordinates.
//   2. iptv-org open dataset (~10k channels worldwide) — fetched on mount,
//      plotted at country centroid (jittered) since most lack a precise lat/lng.
//
// The map reuses the same react-leaflet + cluster pattern as the main /spy/app
// MapView so we don't have to re-learn the styling story.

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'

// Leaflet pulls window globals — load client-only to avoid SSR errors.
const TvMap = dynamic(() => import('./TvMap'), { ssr: false })

import {
  BROADCASTS,
  CATEGORIES,
  CATEGORY_COLOR,
  type Broadcast,
  type BroadcastCategory,
} from '@/lib/liveBroadcasts'
import { centroidFor, jitterCentroid } from '@/lib/countryCentroids'
import TvOverlay from './TvOverlay'

// Unified pin shape consumed by TvMap. Both curated YouTube streams and
// iptv-org HLS streams normalize to this.
export type TvPin = {
  id: string
  name: string
  agency: string
  lat: number
  lng: number
  // Either YouTube embed OR HLS direct stream
  youtubeChannelId?: string
  youtubeVideoId?: string
  hlsUrl?: string
  iframeUrl?: string
  category: BroadcastCategory | 'iptv'
  flag?: string
  description?: string
  thumb?: string | null
  // Soft signal: 'curated' = our list (high confidence works), 'iptv' = bulk
  source: 'curated' | 'iptv'
}

const IPTV_CHANNELS_URL = 'https://iptv-org.github.io/api/channels.json'
const IPTV_STREAMS_URL = 'https://iptv-org.github.io/api/streams.json'

export default function TvPage() {
  const [iptvPins, setIptvPins] = useState<TvPin[]>([])
  const [iptvErr, setIptvErr] = useState<string | null>(null)
  const [iptvLoading, setIptvLoading] = useState(true)
  const [filter, setFilter] = useState<BroadcastCategory | 'all'>('all')
  const [showIptv, setShowIptv] = useState(true)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<TvPin | null>(null)

  // Map curated catalog → TvPin
  const curatedPins: TvPin[] = useMemo(
    () =>
      BROADCASTS.map((b) => ({
        id: `curated:${b.id}`,
        name: b.name,
        agency: b.agency,
        lat: b.lat,
        lng: b.lng,
        youtubeChannelId: b.youtubeChannelId,
        youtubeVideoId: b.youtubeVideoId,
        hlsUrl: b.hlsUrl,
        iframeUrl: b.iframeUrl,
        category: b.category,
        flag: b.flag,
        description: b.description,
        thumb: b.youtubeVideoId ? `https://img.youtube.com/vi/${b.youtubeVideoId}/hqdefault.jpg` : null,
        source: 'curated' as const,
      })),
    [],
  )

  // Bulk-fetch iptv-org on mount. Cross-join channels × streams, plot at
  // country centroid (jittered).
  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch(IPTV_CHANNELS_URL).then((r) => r.json()),
      fetch(IPTV_STREAMS_URL).then((r) => r.json()),
    ])
      .then(([channels, streams]: [any[], any[]]) => {
        if (cancelled) return
        // Build lookup: channel id → first stream URL
        const streamByChannel = new Map<string, string>()
        for (const s of streams) {
          if (!s.channel || !s.url) continue
          if (!streamByChannel.has(s.channel)) streamByChannel.set(s.channel, s.url)
        }
        const pins: TvPin[] = []
        for (const c of channels) {
          if (c.is_nsfw) continue
          if (c.closed) continue
          const url = streamByChannel.get(c.id)
          if (!url) continue
          const country = c.country || (c.broadcast_area || []).find((b: string) => b.startsWith('c/'))?.slice(2)
          if (!country) continue
          const cent = centroidFor(country)
          if (!cent) continue
          const [lat, lng] = jitterCentroid(cent, c.id)
          pins.push({
            id: `iptv:${c.id}`,
            name: c.name,
            agency: country,
            lat,
            lng,
            hlsUrl: url,
            category: 'iptv',
            flag: undefined,
            description: (c.categories || []).join(', '),
            thumb: c.logo || null,
            source: 'iptv',
          })
        }
        setIptvPins(pins)
      })
      .catch((e) => !cancelled && setIptvErr(e?.message || 'iptv-org fetch failed'))
      .finally(() => !cancelled && setIptvLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const allPins = useMemo(() => [...curatedPins, ...(showIptv ? iptvPins : [])], [
    curatedPins,
    iptvPins,
    showIptv,
  ])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allPins.filter((p) => {
      // Category filter: when active, hide all iptv-org pins (they're
      // un-categorized) and require curated pins to match the chosen category.
      if (filter !== 'all') {
        if (p.source === 'iptv') return false
        if (p.category !== filter) return false
      }
      if (q && !p.name.toLowerCase().includes(q) && !p.agency.toLowerCase().includes(q)) return false
      return true
    })
  }, [allPins, filter, query])

  return (
    <main className="relative h-screen w-full bg-[#020D14] text-[#E2E8F0]">
      {/* Sticky top header */}
      <div
        className="absolute inset-x-0 top-0 z-[1000] border-b border-[#0D2235] bg-[#020D14]/95 backdrop-blur"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-base">📺</span>
            <div>
              <div className="text-[10px] font-black tracking-[0.4em] text-[#EF4444]">TV LIVE</div>
              <div className="font-mono text-[10px] text-[#64748B]">
                {iptvLoading
                  ? `${curatedPins.length} curated · loading iptv-org…`
                  : `${visible.length.toLocaleString()} streams worldwide`}
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowIptv((v) => !v)}
            className="rounded border px-2.5 py-1 text-[10px] font-bold tracking-widest transition"
            style={{
              borderColor: showIptv ? '#EF4444' : '#0D2235',
              background: showIptv ? '#EF44441F' : 'transparent',
              color: showIptv ? '#EF4444' : '#64748B',
            }}
          >
            {showIptv ? '🌍 IPTV-ORG ON' : '🌍 IPTV-ORG OFF'}
          </button>
        </div>
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 pb-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Channel, country, agency…"
            className="flex-1 rounded border border-[#0D2235] bg-black/60 px-3 py-1.5 text-xs text-white placeholder-[#334155] outline-none focus:border-[#EF4444]"
          />
        </div>
        <div className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 pb-3">
          {CATEGORIES.map((c) => {
            const active = filter === c.id
            return (
              <button
                key={c.id}
                onClick={() => setFilter(c.id as any)}
                className="shrink-0 rounded border px-3 py-1 text-[10px] font-bold tracking-widest transition"
                style={{
                  borderColor: active ? c.accent : '#0D2235',
                  background: active ? `${c.accent}1F` : 'transparent',
                  color: active ? c.accent : '#64748B',
                }}
              >
                {c.emoji} {c.label.toUpperCase()}
              </button>
            )
          })}
        </div>
      </div>

      {iptvErr && (
        <div className="absolute left-1/2 top-32 z-[1000] -translate-x-1/2 rounded bg-red-900/80 px-3 py-1.5 text-xs text-white">
          iptv-org failed: {iptvErr}
        </div>
      )}

      <TvMap pins={visible} categoryColor={CATEGORY_COLOR} onPick={(p) => setSelected(p)} />

      {selected && <TvOverlay pin={selected} onClose={() => setSelected(null)} />}
    </main>
  )
}
