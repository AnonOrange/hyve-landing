'use client'

// ROULETTE — One button → truly random teleport into live reality on Earth.
//
// Source pool combines THREE globally-distributed inventories so the dice
// can land anywhere on the planet, not just on the few US scanner feeds
// reporting current listeners:
//   1. ALL US scanner feeds (~2000) — listener count is unreliable
//      (most feeds report 0 most of the time), so we no longer filter by it.
//      Listeners just SOFT-WEIGHT the pick: feeds with traffic come up more
//      often, but a 0-listener volunteer fire department in Wyoming is
//      still reachable.
//   2. Worldwide cameras (~24K via /cameras/world) — every Windy webcam +
//      cruise-cam + landmark we know about. Means rolls land on Tokyo,
//      Reykjavik, Cairo, the deck of a cruise ship in the Pacific.
//   3. Curated TV + radio broadcasts (~50) from our catalog — broadcaster
//      HQ cities (NHK Tokyo, BBC London, NASA Houston, etc.).
//
// On each roll we land at one destination, then ALWAYS show the closest
// scanner feed + 4 nearest cameras + closest local TV + closest radio +
// recent crime in 25mi (regardless of which inventory we landed in).
// "What's actually here right now" is the same question regardless of pin
// type, so the surrounding-context fetch is unified.

import { useEffect, useMemo, useState } from 'react'
import { BROADCASTS } from '@/lib/liveBroadcasts'

const API = 'https://hyve-api.vercel.app'

type Destination = {
  id: string
  name: string
  lat: number
  lng: number
  source: 'scanner' | 'camera' | 'broadcast'
  weight: number // soft weighting for pick probability
  // Display fields (vary by source)
  agency?: string
  county?: string
  state?: string
  country?: string
  type?: string
  listeners?: number
  scannerFeedId?: string // if source='scanner', the feed id for /spy/app/feed/...
}

type Feed = { id: string; name: string; lat: number; lng: number; listeners: number; county?: string; state?: string; type?: string }
type Cam = { id: string; name?: string; agency?: string; snapshotUrl?: string; url?: string; lat?: number; lng?: number; latitude?: number; longitude?: number }
type Crime = { id: string; lat: number; lng: number; category?: string; subcategory?: string; description?: string; occurred_at?: string; city?: string }

function haversine(a: [number, number], b: [number, number]) {
  const toR = (x: number) => (x * Math.PI) / 180
  const [lat1, lng1] = a
  const [lat2, lng2] = b
  const dLat = toR(lat2 - lat1)
  const dLng = toR(lng2 - lng1)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * 3958.8 * Math.asin(Math.sqrt(h)) // miles
}

export default function RoulettePage() {
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [feedById, setFeedById] = useState<Map<string, Feed>>(new Map())
  const [pick, setPick] = useState<Destination | null>(null)
  const [cams, setCams] = useState<Cam[]>([])
  const [crime, setCrime] = useState<Crime[]>([])
  const [allCrime, setAllCrime] = useState<Crime[]>([])
  const [spinning, setSpinning] = useState(false)
  const [snapTick, setSnapTick] = useState(0)

  // Bootstrap: 3 globally-distributed inventories + entire crime dataset.
  // The crime fetch is the heaviest (~2.4MB at limit=10000) so don't block
  // the dice on it — we set it asynchronously after destinations are ready.
  useEffect(() => {
    Promise.all([
      fetch(`${API}/feeds/trending?limit=2000`).then((r) => r.json()).catch(() => []),
      fetch(`${API}/cameras/world`).then((r) => r.json()).catch(() => []),
    ]).then(([fRaw, camRaw]) => {
      const fs: any[] = Array.isArray(fRaw) ? fRaw : fRaw?.feeds || []
      const cams: any[] = Array.isArray(camRaw) ? camRaw : camRaw?.cameras || camRaw?.data || []

      const map = new Map<string, Feed>()
      const dests: Destination[] = []

      // 1. Scanner feeds — soft-weighted by listener count (log + 2 floor so
      //    even 0-listener feeds have a real shot at being picked)
      for (const f of fs) {
        const lat = f.lat ?? f.latitude
        const lng = f.lng ?? f.lon ?? f.longitude
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
        const id = f.id || f.feedId
        const feed: Feed = {
          id,
          name: f.name || f.displayName || 'Scanner',
          lat,
          lng,
          listeners: f.listeners || 0,
          county: f.county,
          state: f.state,
          type: f.type || f.feedType,
        }
        map.set(id, feed)
        dests.push({
          id: `s:${id}`,
          name: feed.name,
          lat,
          lng,
          source: 'scanner',
          weight: Math.log10((feed.listeners || 0) + 2) + 0.5,
          county: feed.county,
          state: feed.state,
          type: feed.type,
          listeners: feed.listeners,
          scannerFeedId: id,
        })
      }

      // 2. World cameras — uniform weight 0.7 (slightly under a typical
      //    scanner so the US doesn't overwhelm; still globally numerous so
      //    most rolls actually land somewhere on Earth that isn't the US).
      for (const c of cams) {
        const lat = c.lat ?? c.latitude
        const lng = c.lng ?? c.lon ?? c.longitude
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
        dests.push({
          id: `c:${c.id || `${lat}-${lng}`}`,
          name: c.name || c.title || 'Live Camera',
          lat,
          lng,
          source: 'camera',
          weight: 0.7,
          agency: c.agency,
          country: c.country,
          type: c.feedType,
        })
      }

      // 3. Curated broadcasts — high weight (1.5) since these are flagship
      //    locations (NYC studios, Tokyo, London, NASA Houston, etc.)
      for (const b of BROADCASTS) {
        dests.push({
          id: `b:${b.id}`,
          name: b.name,
          lat: b.lat,
          lng: b.lng,
          source: 'broadcast',
          weight: 1.5,
          agency: b.agency,
          country: b.flag,
          type: b.category,
        })
      }

      setFeedById(map)
      setDestinations(dests)
    })

    // Background: fetch crime separately so the heavy payload doesn't block.
    fetch(`${API}/crime/incidents?limit=10000`)
      .then((r) => r.json())
      .then((cRaw) => {
        const cs: any[] = Array.isArray(cRaw) ? cRaw : cRaw?.incidents || []
        setAllCrime(
          cs
            .map((c) => ({
              id: c.id,
              lat: c.lat ?? c.latitude,
              lng: c.lng ?? c.lon ?? c.longitude,
              category: c.category,
              subcategory: c.subcategory,
              description: c.description,
              occurred_at: c.occurred_at,
              city: c.city,
            }))
            .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng)),
        )
      })
      .catch(() => {})
  }, [])

  // Refresh camera snapshots every 5s while a pick is active.
  useEffect(() => {
    if (!pick) return
    const i = setInterval(() => setSnapTick((t) => t + 1), 5000)
    return () => clearInterval(i)
  }, [pick])

  // Weighted-random pick across the merged 3-source pool. Spinner animation
  // cycles through 8 random uniform picks for theatre, then the FINAL
  // selection respects the per-destination weights.
  const roll = async () => {
    if (destinations.length === 0) return
    setSpinning(true)
    setCams([])
    setCrime([])

    // Pre-spin theatre: uniform random across the pool for visual flicker
    for (let i = 0; i < 8; i++) {
      const r = destinations[Math.floor(Math.random() * destinations.length)]
      setPick(r)
      await new Promise((res) => setTimeout(res, 90 + i * 25))
    }

    // Final pick: weighted-random
    const total = destinations.reduce((a, d) => a + d.weight, 0)
    let r = Math.random() * total
    let chosen = destinations[Math.floor(Math.random() * destinations.length)]
    for (const d of destinations) {
      r -= d.weight
      if (r <= 0) { chosen = d; break }
    }
    setPick(chosen)
    setSpinning(false)

    // Surrounding context fetch — cameras within 25mi
    const camRes = await fetch(`${API}/cameras/nearby?lat=${chosen.lat}&lng=${chosen.lng}&radius=25`).catch(() => null)
    if (camRes?.ok) {
      const camRaw: any = await camRes.json()
      const arr: any[] = Array.isArray(camRaw) ? camRaw : camRaw?.cameras || []
      setCams(arr.slice(0, 4))
    }
    setCrime(
      allCrime
        .map((c) => ({ c, d: haversine([chosen.lat, chosen.lng], [c.lat, c.lng]) }))
        .filter((x) => x.d <= 25)
        .sort((a, b) => a.d - b.d)
        .slice(0, 6)
        .map((x) => x.c),
    )
  }

  // If we landed somewhere outside the US, scanner feed link won't help.
  // Surface the nearest feed when one exists; else just hide the audio CTA.
  const nearestScanner = useMemo(() => {
    if (!pick) return null
    if (pick.scannerFeedId) return feedById.get(pick.scannerFeedId) || null
    let best: Feed | null = null
    let bestD = Infinity
    for (const f of feedById.values()) {
      const d = haversine([pick.lat, pick.lng], [f.lat, f.lng])
      if (d < bestD) { bestD = d; best = f }
    }
    return best && bestD < 100 ? best : null // only surface if within 100mi
  }, [pick, feedById])

  // Closest curated TV + radio (pulled from our hand-picked broadcast catalog;
  // gives a deterministic local-station pick without an extra fetch)
  const localBroadcasts = useMemo(() => {
    if (!pick) return { tv: null, radio: null }
    const sorted = BROADCASTS.map((b) => ({
      b,
      d: haversine([pick.lat, pick.lng], [b.lat, b.lng]),
    })).sort((a, b) => a.d - b.d)
    return {
      tv: sorted.find((x) => x.b.category === 'news' || x.b.category === 'events')?.b ?? null,
      radio: sorted.find((x) => x.b.category === 'music')?.b ?? sorted[0]?.b ?? null,
    }
  }, [pick])

  return (
    <main className="min-h-screen bg-[#020D14] pb-24 text-[#E2E8F0]">
      <div
        className="sticky top-0 z-20 border-b border-[#0D2235] bg-[#020D14]/95 backdrop-blur"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-base">🎲</span>
            <div>
              <div className="text-[10px] font-black tracking-[0.4em] text-[#A855F7]">ROULETTE</div>
              <div className="font-mono text-[10px] text-[#64748B]">
                {destinations.length === 0 ? 'loading reality…' : `${destinations.length.toLocaleString()} live destinations across the planet`}
              </div>
            </div>
          </div>
          <button
            onClick={roll}
            disabled={spinning || destinations.length === 0}
            className="rounded border-2 px-4 py-2 text-xs font-black tracking-widest transition disabled:opacity-50"
            style={{
              borderColor: '#A855F7',
              background: spinning ? '#A855F7' : '#A855F71F',
              color: spinning ? '#020D14' : '#A855F7',
            }}
          >
            {spinning ? '🎲 SPINNING…' : pick ? '🎲 ROLL AGAIN' : '🎲 ROLL'}
          </button>
        </div>
      </div>

      {!pick ? (
        <div className="mx-auto max-w-2xl px-6 pt-24 text-center">
          <div className="text-6xl">🎲</div>
          <h2 className="mt-4 text-2xl font-black">Random Live Reality</h2>
          <p className="mt-3 text-sm text-[#94A3B8]">
            One button. Drops you into a random place on Earth and shows you what&apos;s happening
            there <span className="text-[#A855F7]">right now</span>: a live scanner feed, four
            nearby cameras refreshing every 5 seconds, the closest local TV and radio station,
            and recent crime within 25 miles. Stay or roll again.
          </p>
        </div>
      ) : (
        <div className="mx-auto max-w-5xl px-4 pt-6">
          <div className="rounded-xl border border-[#A855F7]/40 bg-[#A855F7]/5 p-5">
            <div className="text-[10px] font-bold tracking-[0.3em] text-[#A855F7]">
              YOU LANDED · {pick.source.toUpperCase()}
            </div>
            <h2 className="mt-1 text-2xl font-black">{pick.name}</h2>
            <div className="font-mono text-xs text-[#94A3B8]">
              {[pick.county, pick.state, pick.country, pick.agency].filter(Boolean).join(' · ')}
              {pick.listeners ? ` · ${pick.listeners.toLocaleString()} listeners` : ''}
              {pick.type ? ` · ${pick.type}` : ''}
              {' · '}
              <span className="text-[#475569]">
                {pick.lat.toFixed(3)}, {pick.lng.toFixed(3)}
              </span>
            </div>
            {nearestScanner && (
              <a
                href={`/spy/app/feed/${nearestScanner.id}`}
                className="mt-3 inline-block rounded bg-[#A855F7] px-4 py-2 text-xs font-bold tracking-widest text-white"
              >
                ▶ {pick.scannerFeedId ? 'OPEN LIVE AUDIO' : 'NEAREST SCANNER'} →
              </a>
            )}
          </div>

          {/* Camera tiles — auto-refreshing snapshots */}
          {cams.length > 0 && (
            <div className="mt-6">
              <div className="mb-2 text-[10px] font-bold tracking-[0.3em] text-[#22C55E]">📸 4 NEAREST CAMERAS</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {cams.map((c) => {
                  const url = c.snapshotUrl || c.url || ''
                  if (!url) return null
                  const refreshed = `${url}${url.includes('?') ? '&' : '?'}_t=${snapTick}`
                  return (
                    <div key={c.id} className="aspect-video overflow-hidden rounded border border-[#0D2235] bg-black">
                      <img src={refreshed} alt={c.name || ''} className="h-full w-full object-cover" />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Local TV + Radio */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {localBroadcasts.tv && (
              <a href="/spy/app/tv" className="rounded border border-[#0D2235] bg-black/40 p-4 transition hover:border-[#EF4444]">
                <div className="text-[10px] font-bold tracking-[0.3em] text-[#EF4444]">📺 NEAREST TV</div>
                <div className="mt-1 text-sm font-bold">{localBroadcasts.tv.name}</div>
                <div className="font-mono text-[10px] text-[#94A3B8]">{localBroadcasts.tv.agency}</div>
              </a>
            )}
            {localBroadcasts.radio && (
              <a href="/spy/app/radio" className="rounded border border-[#0D2235] bg-black/40 p-4 transition hover:border-[#22C55E]">
                <div className="text-[10px] font-bold tracking-[0.3em] text-[#22C55E]">📻 NEAREST RADIO</div>
                <div className="mt-1 text-sm font-bold">{localBroadcasts.radio.name}</div>
                <div className="font-mono text-[10px] text-[#94A3B8]">{localBroadcasts.radio.agency}</div>
              </a>
            )}
          </div>

          {/* Recent crime within 25mi */}
          {crime.length > 0 && (
            <div className="mt-6">
              <div className="mb-2 text-[10px] font-bold tracking-[0.3em] text-[#FF2D2D]">⚠️ RECENT CRIME WITHIN 25 MILES</div>
              <ul className="grid gap-1.5 text-xs">
                {crime.map((c) => (
                  <li key={c.id} className="rounded border border-[#0D2235] bg-black/30 px-3 py-1.5 font-mono text-[#94A3B8]">
                    <span className="text-[#FF2D2D]">{c.subcategory || c.category || 'incident'}</span>
                    {c.city ? ` · ${c.city}` : ''}
                    {c.description ? ` · ${c.description}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </main>
  )
}
