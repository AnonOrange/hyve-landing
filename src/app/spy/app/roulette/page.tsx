'use client'

// ROULETTE — One button → random teleport into live reality somewhere on Earth.
//
// Picks a random scanner feed (weighted by listener count so popular feeds are
// more likely than dead ones, but every feed has nonzero chance), then assembles
// "what's happening right there right now":
//   - Scanner audio (we link out to the feed page rather than embedding to keep
//     this view lightweight; scanner audio playback already works on /feed/[id])
//   - 4 nearest cameras tiled (live snapshots auto-refresh every 5s)
//   - Closest local TV / radio station from our curated catalog
//   - Recent crime in 25mi radius
//
// Chatroulette for live data — but you can stay as long as you want.

import { useEffect, useMemo, useState } from 'react'
import { BROADCASTS } from '@/lib/liveBroadcasts'

const API = 'https://hyve-api.vercel.app'

type Feed = { id: string; name: string; lat: number; lng: number; listeners: number; county?: string; state?: string; type?: string }
type Cam = { id: string; name?: string; agency?: string; snapshotUrl?: string; url?: string; lat?: number; lng?: number; latitude?: number; longitude?: number }
type Crime = { id: string; lat: number; lng: number; category?: string; offense?: string; occurred_at?: string; address?: string }

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
  const [feeds, setFeeds] = useState<Feed[]>([])
  const [pick, setPick] = useState<Feed | null>(null)
  const [cams, setCams] = useState<Cam[]>([])
  const [crime, setCrime] = useState<Crime[]>([])
  const [allCrime, setAllCrime] = useState<Crime[]>([])
  const [spinning, setSpinning] = useState(false)
  const [snapTick, setSnapTick] = useState(0)

  // Bootstrap: feeds + entire crime dataset (so each roll is instant).
  useEffect(() => {
    Promise.all([
      fetch(`${API}/feeds/trending?limit=2000`).then((r) => r.json()).catch(() => []),
      fetch(`${API}/crime/incidents?limit=10000`).then((r) => r.json()).catch(() => []),
    ]).then(([fRaw, cRaw]) => {
      const fs: any[] = Array.isArray(fRaw) ? fRaw : fRaw?.feeds || []
      const cs: any[] = Array.isArray(cRaw) ? cRaw : cRaw?.incidents || []
      setFeeds(
        fs
          .map((f) => ({
            id: f.id || f.feedId,
            name: f.name || f.displayName || 'Scanner',
            lat: f.lat ?? f.latitude,
            lng: f.lng ?? f.lon ?? f.longitude,
            listeners: f.listeners || 0,
            county: f.county,
            state: f.state,
            type: f.type || f.feedType,
          }))
          .filter((f) => Number.isFinite(f.lat) && Number.isFinite(f.lng) && f.listeners > 0),
      )
      setAllCrime(
        cs
          .map((c) => ({
            id: c.id,
            lat: c.lat ?? c.latitude,
            lng: c.lng ?? c.lon ?? c.longitude,
            category: c.category,
            offense: c.offense,
            occurred_at: c.occurred_at,
            address: c.address,
          }))
          .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng)),
      )
    })
  }, [])

  // Refresh camera snapshots every 5s while a pick is active.
  useEffect(() => {
    if (!pick) return
    const i = setInterval(() => setSnapTick((t) => t + 1), 5000)
    return () => clearInterval(i)
  }, [pick])

  // Weighted-random feed pick: weight = log(listeners+1) so popular feeds are
  // picked more often, but a 5-listener feed in nowhere Idaho still has a
  // ~5% shot at landing. That's the magic — sometimes you get NYC, sometimes
  // you get a single-truck volunteer fire department in Wyoming.
  const roll = async () => {
    if (feeds.length === 0) return
    setSpinning(true)
    setCams([])
    setCrime([])
    // Spinner animation: cycle through 8 random picks visually
    for (let i = 0; i < 8; i++) {
      const r = feeds[Math.floor(Math.random() * feeds.length)]
      setPick(r)
      await new Promise((res) => setTimeout(res, 90 + i * 25))
    }
    const weights = feeds.map((f) => Math.log10(f.listeners + 1))
    const total = weights.reduce((a, b) => a + b, 0)
    let r = Math.random() * total
    let chosen = feeds[0]
    for (let i = 0; i < feeds.length; i++) {
      r -= weights[i]
      if (r <= 0) { chosen = feeds[i]; break }
    }
    setPick(chosen)
    setSpinning(false)

    // Fetch surrounding context
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
                {feeds.length === 0 ? 'loading reality…' : `${feeds.length.toLocaleString()} live destinations · roll the dice`}
              </div>
            </div>
          </div>
          <button
            onClick={roll}
            disabled={spinning || feeds.length === 0}
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
            <div className="text-[10px] font-bold tracking-[0.3em] text-[#A855F7]">YOU LANDED IN</div>
            <h2 className="mt-1 text-2xl font-black">{pick.name}</h2>
            <div className="font-mono text-xs text-[#94A3B8]">
              {pick.county || ''} {pick.state ? `· ${pick.state}` : ''} · {pick.listeners.toLocaleString()} listeners · {pick.type || 'scanner'}
            </div>
            <a
              href={`/spy/app/feed/${pick.id}`}
              className="mt-3 inline-block rounded bg-[#A855F7] px-4 py-2 text-xs font-bold tracking-widest text-white"
            >
              ▶ OPEN LIVE AUDIO →
            </a>
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
                    <span className="text-[#FF2D2D]">{c.category || c.offense || 'incident'}</span>
                    {c.address ? ` · ${c.address}` : ''}
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
