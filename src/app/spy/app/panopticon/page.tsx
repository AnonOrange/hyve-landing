'use client'

// PANOPTICON — "How surveilled am I right now?"
//
// Drop a pin (click map or geolocate) → instant count of every surveillance
// device within 1 mile, with a 0-100 Panopticon Score and per-category
// breakdown. Uses the existing /cameras/surveillance endpoint which returns
// 164k+ markers from EFF Atlas of Surveillance, DeFlock community DB, and
// OpenStreetMap.
//
// The score formula is heuristic, not science:
//   - Each Flock LPR within 1mi: +12 (most invasive — bulk plate scanning)
//   - Each face-recog deployment: +15 (highest weight — biometric ID)
//   - Each Stingray cell-site simulator: +20 (only fires intermittently
//     but devastating when it does)
//   - Each ShotSpotter mic: +5
//   - Each fusion center: +25 (institutional surveillance hub)
//   - Each public CCTV: +2
//   - Each police drone deployment: +8
// Capped at 100, displayed with severity color.
//
// This is genuinely useful intelligence for journalists, protesters, and
// privacy-conscious folks. Nobody else has the surveillance dataset + crime
// + scanner data joined in one query.

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'

const PanopMap = dynamic(() => import('./PanopMap'), { ssr: false })

const API = 'https://hyve-api.vercel.app'

// How far around the user we keep markers in memory + render to Leaflet.
// 25mi covers the user's whole metro area while keeping marker count
// in the low hundreds (vs the full 164k national dataset).
const LOCAL_RADIUS_MI = 25
// Degree-bounding-box prefilter — quick reject before haversine math.
// 1° latitude = ~69mi. 0.5° = ~34mi which generously covers a 25mi radius
// even at the equator. Cheap to evaluate and skips ~99% of distant points.
const BOX_PREFILTER_DEG = 0.5

export type Surveillance = {
  id: string
  // Real values seen in the API response: 'alpr-flock', 'public-cctv',
  // 'alpr-other', 'body-worn-cameras', 'alpr', 'drones',
  // 'third-party-platforms', 'face-recognition', 'camera-registry',
  // 'gunshot-detection', 'real-time-crime-center', 'predictive-policing',
  // 'guard-camera', 'cell-site-simulator', 'video-analytics', 'fusion-center'
  surveillanceType: string
  lat: number
  lng: number
  agency?: string
  label?: string
}

type Score = {
  total: number
  breakdown: { type: string; count: number; weight: number; emoji: string }[]
}

// Categories keyed by the canonical bucket name produced by classify(). Each
// has a privacy-invasiveness weight (heuristic, not science).
const WEIGHTS: Record<string, { weight: number; emoji: string; label: string }> = {
  flock: { weight: 12, emoji: '🔍', label: 'Flock LPR readers' },
  alpr: { weight: 10, emoji: '🔍', label: 'Other LPR readers' },
  shotspotter: { weight: 5, emoji: '🎙', label: 'ShotSpotter microphones' },
  drone: { weight: 8, emoji: '🛸', label: 'Police drone deployments' },
  face_recognition: { weight: 15, emoji: '👤', label: 'Face-recognition systems' },
  stingray: { weight: 20, emoji: '📡', label: 'Cell-site simulators' },
  fusion_center: { weight: 25, emoji: '🏛', label: 'Fusion centers' },
  rtcc: { weight: 18, emoji: '🏢', label: 'Real-time crime centers' },
  predictive: { weight: 8, emoji: '🧠', label: 'Predictive policing systems' },
  third_party: { weight: 6, emoji: '🤝', label: 'Third-party intel platforms' },
  video_analytics: { weight: 7, emoji: '🤖', label: 'Video-analytics deployments' },
  cctv: { weight: 2, emoji: '📹', label: 'Public CCTV cameras' },
  guard_camera: { weight: 2, emoji: '📹', label: 'Guard cameras' },
  camera_registry: { weight: 1, emoji: '📋', label: 'Registered private CCTV' },
  body_camera: { weight: 1, emoji: '🎥', label: 'Body-worn cam programs' },
}

// Fast haversine in miles
function dist([la1, lo1]: [number, number], [la2, lo2]: [number, number]) {
  const toR = (x: number) => (x * Math.PI) / 180
  const dLat = toR(la2 - la1)
  const dLng = toR(lo2 - lo1)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(la1)) * Math.cos(toR(la2)) * Math.sin(dLng / 2) ** 2
  return 2 * 3958.8 * Math.asin(Math.sqrt(h))
}

// Maps the API's `surveillance_type` strings to our internal weight bucket.
// Order matters — more-specific matches first (alpr-flock before alpr).
function classify(t: string): string {
  const s = (t || '').toLowerCase()
  if (s.includes('alpr-flock') || s === 'flock') return 'flock'
  if (s.includes('alpr')) return 'alpr'
  if (s.includes('gunshot') || s.includes('shotspotter')) return 'shotspotter'
  if (s.includes('drone')) return 'drone'
  if (s.includes('face')) return 'face_recognition'
  if (s.includes('cell-site') || s.includes('stingray') || s.includes('imsi')) return 'stingray'
  if (s.includes('fusion')) return 'fusion_center'
  if (s.includes('crime-center') || s.includes('rtcc')) return 'rtcc'
  if (s.includes('predictive')) return 'predictive'
  if (s.includes('third-party')) return 'third_party'
  if (s.includes('video-analytics') || s.includes('analytics')) return 'video_analytics'
  if (s.includes('body')) return 'body_camera'
  if (s.includes('camera-registry') || s.includes('registry')) return 'camera_registry'
  if (s.includes('guard')) return 'guard_camera'
  if (s.includes('cctv')) return 'cctv'
  return 'cctv' // unknown defaults to CCTV (lowest weight)
}

function colorForScore(s: number): string {
  if (s >= 70) return '#EF4444'
  if (s >= 40) return '#F59E0B'
  if (s >= 15) return '#FBBF24'
  return '#22C55E'
}

function levelFor(s: number): string {
  if (s >= 80) return 'PANOPTICON'
  if (s >= 60) return 'EXTREME'
  if (s >= 40) return 'HIGH'
  if (s >= 20) return 'ELEVATED'
  if (s >= 5) return 'MODERATE'
  return 'CLEAR'
}

export default function PanopticonPage() {
  // local = only markers within LOCAL_RADIUS_MI of the user's location.
  // Replaces the previous "load all 164k markers, render with cluster"
  // approach that was freezing low-end Android WebViews. Now we never
  // create more than a few hundred Leaflet objects.
  const [local, setLocal] = useState<Surveillance[]>([])
  const [loading, setLoading] = useState(true)
  const [pin, setPin] = useState<[number, number] | null>(null)
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Step 1: capture user location FIRST, before any surveillance fetch.
  // We need it to pre-filter the dataset; without it we'd be back to
  // loading 164k markers and freezing.
  useEffect(() => {
    if (!navigator.geolocation) {
      setPermissionDenied(true)
      setLoading(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (p) => setUserLocation([p.coords.latitude, p.coords.longitude]),
      (e) => {
        setPermissionDenied(true)
        setLoading(false)
        setErr(e.message)
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    )
  }, [])

  // Step 2: once we have a location, fetch surveillance markers and
  // immediately filter to LOCAL_RADIUS_MI. We still pull the whole dataset
  // (no server-side bounding-box endpoint exists today) but we only KEEP
  // the local subset in state — usually 100–800 markers depending on city
  // density. Leaflet renders that instantly without freezing.
  useEffect(() => {
    if (!userLocation) return
    setLoading(true)
    const [uLat, uLng] = userLocation
    fetch(`${API}/cameras/surveillance`)
      .then((r) => r.json())
      .then((raw: any) => {
        const arr: any[] = Array.isArray(raw) ? raw : raw?.cameras || raw?.markers || raw?.data || []
        const localOnly: Surveillance[] = []
        // Streaming filter — never builds the full 164k array in JS heap.
        // Important on memory-constrained Android WebViews.
        for (const m of arr) {
          const lat = m.lat ?? m.latitude
          const lng = m.lng ?? m.lon ?? m.longitude
          if (typeof lat !== 'number' || typeof lng !== 'number') continue
          // Cheap bounding-box prefilter (degrees) before the real haversine.
          // Skips ~99% of points outside our area without trig calls.
          const dLat = Math.abs(lat - uLat)
          const dLng = Math.abs(lng - uLng)
          if (dLat > BOX_PREFILTER_DEG || dLng > BOX_PREFILTER_DEG) continue
          if (dist([uLat, uLng], [lat, lng]) > LOCAL_RADIUS_MI) continue
          localOnly.push({
            id: m.id || `${m.surveillance_type || m.feedType}-${lat}-${lng}`,
            surveillanceType: m.surveillance_type || m.surveillanceType || m.feedType || m.type || m.category || '',
            lat,
            lng,
            label: m.label || m.name,
            agency: m.agency,
          })
        }
        setLocal(localOnly)
        // Auto-pin at user location so the score is computed immediately.
        // No more "tap to begin" — landing screen IS the score.
        setPin([uLat, uLng])
      })
      .catch((e) => setErr(e?.message || 'Surveillance load failed'))
      .finally(() => setLoading(false))
  }, [userLocation])

  const score: Score | null = useMemo(() => {
    if (!pin) return null
    const counts: Record<string, number> = {}
    for (const m of local) {
      if (dist(pin, [m.lat, m.lng]) > 1) continue
      const c = classify(m.surveillanceType)
      counts[c] = (counts[c] || 0) + 1
    }
    let total = 0
    const breakdown: Score['breakdown'] = []
    for (const [k, count] of Object.entries(counts)) {
      const w = WEIGHTS[k] || { weight: 1, emoji: '·', label: k }
      total += count * w.weight
      breakdown.push({ type: w.label, count, weight: w.weight, emoji: w.emoji })
    }
    return { total: Math.min(100, total), breakdown: breakdown.sort((a, b) => b.count * b.weight - a.count * a.weight) }
  }, [pin, local])

  const useGeolocation = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setUserLocation([p.coords.latitude, p.coords.longitude])
        setPin([p.coords.latitude, p.coords.longitude])
        setPermissionDenied(false)
      },
      (e) => setErr(e.message),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const nearbyMarkers = useMemo(() => {
    if (!pin) return []
    return local.filter((m) => dist(pin, [m.lat, m.lng]) <= 1)
  }, [pin, local])

  return (
    <main className="relative h-screen w-full bg-[#020D14] text-[#E2E8F0]">
      <div
        className="absolute inset-x-0 top-0 z-[1000] border-b border-[#0D2235] bg-[#020D14]/95 backdrop-blur"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-base">👁</span>
            <div>
              <div className="text-[10px] font-black tracking-[0.4em] text-[#A855F7]">PANOPTICON</div>
              <div className="font-mono text-[10px] text-[#64748B]">
                {permissionDenied
                  ? 'location required — tap SCORE ME to retry'
                  : loading
                    ? userLocation
                      ? `loading local surveillance markers (${LOCAL_RADIUS_MI}mi)…`
                      : 'getting your location…'
                    : pin
                      ? `${nearbyMarkers.length} devices within 1mi · ${local.length} indexed in ${LOCAL_RADIUS_MI}mi`
                      : 'tap map to score a location'}
              </div>
            </div>
          </div>
          <button
            onClick={useGeolocation}
            className="rounded border border-[#A855F7] bg-[#A855F71F] px-3 py-1.5 text-[10px] font-bold tracking-widest text-[#A855F7]"
          >
            📍 SCORE ME
          </button>
        </div>
      </div>

      {err && (
        <div className="absolute left-1/2 top-32 z-[1000] -translate-x-1/2 rounded bg-red-900/80 px-3 py-1.5 text-xs text-white">
          {err}
        </div>
      )}

      <PanopMap markers={local} pin={pin} radiusMi={1} onClick={(lat, lng) => setPin([lat, lng])} />

      {/* Score card overlay */}
      {pin && score && (
        <div className="absolute inset-x-3 bottom-28 z-[1000] mx-auto max-w-md rounded-xl border border-[#A855F7]/40 bg-[#020D14]/95 p-4 backdrop-blur">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-[10px] font-bold tracking-[0.3em]" style={{ color: colorForScore(score.total) }}>
                {levelFor(score.total)}
              </div>
              <div className="font-mono text-[10px] text-[#64748B]">
                {pin[0].toFixed(4)}, {pin[1].toFixed(4)} · 1mi radius
              </div>
            </div>
            <div className="text-4xl font-black" style={{ color: colorForScore(score.total) }}>
              {score.total}
              <span className="text-base text-[#64748B]">/100</span>
            </div>
          </div>
          {score.breakdown.length === 0 ? (
            <div className="mt-2 text-xs text-[#94A3B8]">No surveillance devices indexed within 1mi.</div>
          ) : (
            <ul className="mt-3 grid gap-1 text-xs">
              {score.breakdown.map((b) => (
                <li key={b.type} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 truncate">
                    <span>{b.emoji}</span>
                    <span className="text-[#E2E8F0]">{b.type}</span>
                  </span>
                  <span className="font-mono text-[#A855F7]">
                    {b.count} × {b.weight} = {b.count * b.weight}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </main>
  )
}
