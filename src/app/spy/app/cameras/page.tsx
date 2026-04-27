'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CameraOverlay, camName, camUrl, youtubeId, type Camera } from '../CameraOverlay'
import FreshnessBadge from '../FreshnessBadge'

// Cameras now load from our Supabase-backed cache via /api/realtime/cameras.
// The cache is refreshed every 60s by the Railway worker that pings
// /api/cron/realtime-sync. Geo-filtering on the server means the response
// is ~50-200KB instead of the 18MB full-CONUS blob.
const PAGE_SIZE = 60

const TYPES = ['all', 'ptz', 'snapshot', 'youtube', 'hls', 'webview'] as const
type Filter = (typeof TYPES)[number]

export default function CamerasPage() {
  const [all, setAll] = useState<Camera[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<Camera | null>(null)
  const [userPos, setUserPos] = useState<[number, number] | null>(null)
  const [radius, setRadius] = useState<number>(100)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // Geolocate the user (best-effort — fall back to nationwide if denied)
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (p) => setUserPos([p.coords.latitude, p.coords.longitude]),
      () => setUserPos(null),
      { enableHighAccuracy: false, maximumAge: 5 * 60_000, timeout: 5_000 },
    )
  }, [])

  // Load cameras from the realtime cache.
  // - With user location: fetch only within `radius` miles → tiny payload
  // - Without: fetch top 1000 nationwide
  // Refreshes every 60s to pick up cache updates.
  useEffect(() => {
    let cancelled = false
    let intervalId: ReturnType<typeof setInterval> | null = null

    async function load() {
      try {
        const params = new URLSearchParams()
        if (userPos) {
          params.set('lat', String(userPos[0]))
          params.set('lng', String(userPos[1]))
          params.set('radius_mi', String(radius))
          params.set('limit', '1000')
        } else {
          params.set('limit', '1000')
        }
        const r = await fetch(`/api/realtime/cameras?${params}`, { cache: 'no-store' })
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const j = await r.json()
        if (cancelled) return
        const arr: Camera[] = j.cameras ?? []
        setAll(arr.filter((c) => camUrl(c)))
        setErr(null)
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Load failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    intervalId = setInterval(load, 60_000)
    return () => {
      cancelled = true
      if (intervalId) clearInterval(intervalId)
    }
  }, [userPos, radius])

  // Filter + search
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter((c) => {
      // 'ptz' filter is special — matches the new isPtzControllable flag, not the feedType
      if (filter === 'ptz' && !c.isPtzControllable) return false
      if (filter !== 'all' && filter !== 'ptz' && (c.feedType || '').toLowerCase() !== filter) return false
      if (q && !camName(c).toLowerCase().includes(q) && !(c.agency || '').toLowerCase().includes(q)) return false
      return true
    })
  }, [all, query, filter])

  // Reset visible window when filter/search changes
  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [query, filter])

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((n) => Math.min(n + PAGE_SIZE, filtered.length))
        }
      },
      { rootMargin: '600px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [filtered.length])

  const visible = filtered.slice(0, visibleCount)

  return (
    <main className="min-h-screen bg-[#020D14] pb-24 text-[#E2E8F0]">
      <div
        className="sticky top-0 z-20 border-b border-[#0D2235] bg-[#020D14]/95 backdrop-blur"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="text-[10px] font-black tracking-[0.4em] text-[#00D4FF]">CAMERAS</div>
            <span className="font-mono text-[10px] text-[#64748B]">
              {loading ? 'loading…' : `${filtered.length.toLocaleString()} live`}
            </span>
          </div>
          <FreshnessBadge accent="#00D4FF" />
        </div>
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 pb-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, city, agency…"
            className="flex-1 rounded border border-[#0D2235] bg-black/60 px-3 py-1.5 text-xs text-white placeholder-[#334155] outline-none focus:border-[#00D4FF]"
          />
        </div>
        <div className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 pb-3">
          {TYPES.map((t) => {
            const isPtz = t === 'ptz'
            const activeClr = isPtz ? '#A855F7' : '#00D4FF'
            const active = filter === t
            return (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className="shrink-0 rounded border px-3 py-1 text-[10px] font-bold tracking-widest transition"
                style={{
                  borderColor: active ? activeClr : '#0D2235',
                  background: active ? `${activeClr}1F` : 'transparent',
                  color: active ? activeClr : '#64748B',
                }}
              >
                {isPtz ? '🎮 PTZ' : t.toUpperCase()}
              </button>
            )
          })}
        </div>
      </div>

      {err && <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-[#FF2D2D]">{err}</div>}

      <div className="mx-auto max-w-5xl px-4 pt-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {visible.map((cam, i) => (
            <CameraThumb key={cam.id || `${i}-${camUrl(cam)}`} cam={cam} onOpen={() => setSelected(cam)} />
          ))}
        </div>
        {!loading && filtered.length === 0 && (
          <div className="py-16 text-center text-sm text-[#64748B]">No cameras match.</div>
        )}
        {visibleCount < filtered.length && (
          <div ref={sentinelRef} className="py-8 text-center font-mono text-[10px] text-[#334155]">
            loading more…
          </div>
        )}
      </div>

      {selected && <CameraOverlay cam={selected} onClose={() => setSelected(null)} />}
    </main>
  )
}

function CameraThumb({ cam, onOpen }: { cam: Camera; onOpen: () => void }) {
  const url = camUrl(cam)
  const name = camName(cam)
  const type = (cam.feedType || '').toLowerCase()
  const [tick, setTick] = useState(0)
  const isSnap = type === 'snapshot' || (!type && /\.(jpg|jpeg|png|gif)(\?|$)/i.test(url))

  // Refresh static snapshots every 10s in the grid (vs 2s in the popout — saves bandwidth)
  useEffect(() => {
    if (!isSnap) return
    const i = setInterval(() => setTick((t) => t + 1), 10000)
    return () => clearInterval(i)
  }, [isSnap])

  const ytId = type === 'youtube' || /youtube\.com|youtu\.be/.test(url) ? youtubeId(url) : null
  const thumbSrc = ytId
    ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
    : isSnap
      ? `${url}${url.includes('?') ? '&' : '?'}_t=${tick}`
      : null

  return (
    <button
      onClick={onOpen}
      className="group relative aspect-video overflow-hidden rounded border border-[#0D2235] bg-black text-left transition hover:border-[#00D4FF]"
    >
      {thumbSrc ? (
        <img
          src={thumbSrc}
          alt={name}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={(e) => ((e.target as HTMLImageElement).style.opacity = '0.2')}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] font-bold tracking-widest text-[#475569]">
          {(type || 'STREAM').toUpperCase()}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-2">
        <div className="truncate text-[11px] font-bold text-white">{name}</div>
        {cam.agency && <div className="truncate font-mono text-[9px] text-[#94A3B8]">{cam.agency}</div>}
      </div>
      <div className="absolute right-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[9px] tracking-widest text-[#00D4FF]">
        {(type || 'snap').toUpperCase()}
      </div>
    </button>
  )
}
