'use client'

// PULSE — Live National Activity Heatmap.
//
// Fuses three independent live signals into one "where is something happening
// right now" heat layer:
//
//   1. Scanner listener spikes — current listener count vs the feed's typical
//      baseline. When listeners surge, real responders + civilians are tuning
//      in because something is breaking. We use the absolute listener count
//      (no historical baseline available client-side) and normalize to the
//      max in the dataset.
//
//   2. Crime cadence — incidents per city in the last 6 hours. Cities
//      reporting 3+ recent crimes get a heat contribution.
//
//   3. (Future: Whisper STT keyword bursts) — when /now-playing summaries
//      contain "shots fired" / "structure fire" / "officer down", boost
//      that feed's intensity. Currently we don't fetch summaries client-side
//      because that's N requests; revisit once the API has a bulk endpoint.
//
// Visualization: each contribution is a CircleMarker sized by intensity and
// colored on a green→yellow→red ramp. We don't use leaflet.heat because the
// blob style hides the "click to investigate" affordance — we want pins.

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'

const PulseMap = dynamic(() => import('./PulseMap'), { ssr: false })

export type PulsePoint = {
  id: string
  lat: number
  lng: number
  intensity: number // 0..1
  source: 'scanner' | 'crime'
  label: string
  detail: string
}

// Pulse pulls from the Supabase-backed realtime cache via /api/realtime/*.
// Cache is refreshed every 60s by the Railway worker.
const API = '/api/realtime'

export default function PulsePage() {
  const [points, setPoints] = useState<PulsePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [showScanner, setShowScanner] = useState(true)
  const [showCrime, setShowCrime] = useState(true)
  const [tick, setTick] = useState(0) // forces refetch every 60s

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetch(`${API}/feeds?limit=2000`, { cache: 'no-store' }).then((r) => r.json()).catch(() => ({ feeds: [] })),
      fetch(`${API}/crime?limit=10000&since_hours=24`, { cache: 'no-store' }).then((r) => r.json()).catch(() => ({ incidents: [] })),
    ])
      .then(([feedsRaw, crimeRaw]) => {
        if (cancelled) return
        const feeds: any[] = feedsRaw?.feeds || []
        const crimes: any[] = crimeRaw?.incidents || []

        // Normalize listener-spike intensity by dataset max so the heat ramp
        // doesn't get crushed by one outlier scanner. Below threshold = quiet.
        const maxListeners = Math.max(1, ...feeds.map((f) => f.listeners || f.listenerCount || 0))
        const scannerPts: PulsePoint[] = feeds
          .map((f): PulsePoint | null => {
            const lat = f.lat ?? f.latitude
            const lng = f.lng ?? f.lon ?? f.longitude
            const listeners = f.listeners || f.listenerCount || 0
            if (typeof lat !== 'number' || typeof lng !== 'number') return null
            if (listeners < 5) return null // ignore dead feeds
            return {
              id: `s:${f.id || f.feedId}`,
              lat,
              lng,
              intensity: Math.min(1, Math.log10(listeners + 1) / Math.log10(maxListeners + 1)),
              source: 'scanner',
              label: f.name || f.displayName || 'Scanner Feed',
              detail: `${listeners.toLocaleString()} listeners · ${f.county || f.state || ''}`,
            }
          })
          .filter((x): x is PulsePoint => !!x)

        // Crime cadence: cluster incidents by ~10km grid cell. Cells with 3+
        // recent (last 24h) crimes contribute heat proportional to count.
        const since = Date.now() - 24 * 60 * 60 * 1000
        const cells = new Map<string, { lat: number; lng: number; count: number; samples: string[] }>()
        for (const c of crimes) {
          const lat = c.lat ?? c.latitude
          const lng = c.lng ?? c.lon ?? c.longitude
          if (typeof lat !== 'number' || typeof lng !== 'number') continue
          const ts = c.occurred_at ? new Date(c.occurred_at).getTime() : 0
          if (ts && ts < since) continue
          const key = `${Math.round(lat * 10) / 10}:${Math.round(lng * 10) / 10}`
          const cur = cells.get(key) || { lat, lng, count: 0, samples: [] }
          cur.count += 1
          if (cur.samples.length < 3) cur.samples.push(c.category || c.offense || '')
          cells.set(key, cur)
        }
        const maxCellCount = Math.max(1, ...[...cells.values()].map((c) => c.count))
        const crimePts: PulsePoint[] = [...cells.entries()]
          .filter(([_, v]) => v.count >= 3)
          .map(([k, v]) => ({
            id: `c:${k}`,
            lat: v.lat,
            lng: v.lng,
            intensity: Math.min(1, v.count / maxCellCount),
            source: 'crime' as const,
            label: `${v.count} recent crimes`,
            detail: v.samples.filter(Boolean).slice(0, 3).join(', ') || 'last 24h',
          }))

        setPoints([...scannerPts, ...crimePts])
      })
      .catch((e) => !cancelled && setErr(e?.message || 'Pulse load failed'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [tick])

  // Auto-refresh every 60s — listener counts are the live signal here.
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(i)
  }, [])

  const visible = useMemo(
    () =>
      points.filter((p) =>
        p.source === 'scanner' ? showScanner : p.source === 'crime' ? showCrime : true,
      ),
    [points, showScanner, showCrime],
  )

  const hot = visible.filter((p) => p.intensity > 0.6).length

  return (
    <main className="relative h-screen w-full bg-[#020D14] text-[#E2E8F0]">
      <div
        className="absolute inset-x-0 top-0 z-[1000] border-b border-[#0D2235] bg-[#020D14]/95 backdrop-blur"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-base">🔴</span>
            <div>
              <div className="text-[10px] font-black tracking-[0.4em] text-[#FF2D2D]">PULSE</div>
              <div className="font-mono text-[10px] text-[#64748B]">
                {loading
                  ? 'fusing signals…'
                  : err
                    ? `error: ${err}`
                    : `${visible.length.toLocaleString()} hot zones · ${hot} flaring · refresh 60s`}
              </div>
            </div>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => setShowScanner((v) => !v)}
              className="rounded border px-2 py-1 text-[9px] font-bold tracking-widest"
              style={{
                borderColor: showScanner ? '#00D4FF' : '#0D2235',
                background: showScanner ? '#00D4FF1F' : 'transparent',
                color: showScanner ? '#00D4FF' : '#64748B',
              }}
            >
              SCAN
            </button>
            <button
              onClick={() => setShowCrime((v) => !v)}
              className="rounded border px-2 py-1 text-[9px] font-bold tracking-widest"
              style={{
                borderColor: showCrime ? '#EF4444' : '#0D2235',
                background: showCrime ? '#EF44441F' : 'transparent',
                color: showCrime ? '#EF4444' : '#64748B',
              }}
            >
              CRIME
            </button>
            <button
              onClick={() => setTick((t) => t + 1)}
              className="rounded border border-[#0D2235] px-2 py-1 text-[9px] font-bold tracking-widest text-[#94A3B8]"
            >
              ↻
            </button>
          </div>
        </div>
      </div>

      <PulseMap points={visible} />

      <div className="absolute bottom-32 left-4 z-[1000] rounded border border-[#0D2235] bg-black/80 px-3 py-2 font-mono text-[10px] text-[#94A3B8] backdrop-blur">
        <div className="mb-1 font-bold text-[#FF2D2D]">HEAT RAMP</div>
        <div className="flex items-center gap-2">
          <span style={{ color: '#22C55E' }}>● low</span>
          <span style={{ color: '#F59E0B' }}>● medium</span>
          <span style={{ color: '#EF4444' }}>● flaring</span>
        </div>
      </div>
    </main>
  )
}
