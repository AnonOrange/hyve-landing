'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CameraOverlay, camName, camUrl, youtubeId, type Camera } from '../CameraOverlay'

const API_BASE = 'https://hyve-api.vercel.app'
const PAGE_SIZE = 60

const TYPES = ['all', 'snapshot', 'youtube', 'hls', 'webview'] as const
type Filter = (typeof TYPES)[number]

export default function CamerasPage() {
  const [all, setAll] = useState<Camera[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<Camera | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // Load all cameras (CONUS-wide via huge radius — backend caps at the region anyway)
  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE}/cameras/nearby?lat=39.8&lng=-98.5&radius=5000`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        const arr: Camera[] = Array.isArray(j) ? j : (j?.cameras ?? j?.data ?? [])
        setAll(arr.filter((c) => camUrl(c)))
      })
      .catch((e) => !cancelled && setErr(e.message || 'Load failed'))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [])

  // Filter + search
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter((c) => {
      if (filter !== 'all' && (c.feedType || '').toLowerCase() !== filter) return false
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
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <div className="text-[10px] font-black tracking-[0.4em] text-[#00D4FF]">CAMERAS</div>
          <span className="font-mono text-[10px] text-[#64748B]">
            {loading ? 'loading…' : `${filtered.length.toLocaleString()} live`}
          </span>
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
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`shrink-0 rounded border px-3 py-1 text-[10px] font-bold tracking-widest transition ${
                filter === t
                  ? 'border-[#00D4FF] bg-[#00D4FF]/10 text-[#00D4FF]'
                  : 'border-[#0D2235] text-[#64748B] hover:text-[#E2E8F0]'
              }`}
            >
              {t.toUpperCase()}
            </button>
          ))}
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
