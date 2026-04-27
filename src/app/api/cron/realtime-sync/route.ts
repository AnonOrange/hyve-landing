// Vercel cron: every minute, fetch fresh data from hyve-api and upsert into
// the live_* Supabase tables. Client API routes read from those tables with
// geo filters so each user gets a small slice instead of the full 18MB blob.
//
// Triggered by vercel.json's cron config:
//   { "path": "/api/cron/realtime-sync", "schedule": "* * * * *" }
//
// Auth: same `Authorization: Bearer <CRON_SECRET>` pattern as the existing
// /api/cron/snapshot route.

import { NextRequest, NextResponse } from 'next/server'
import { supaPost, supaPatch } from '@/lib/supabase'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

const CRON_SECRET = process.env.CRON_SECRET
const HYVE_API = 'https://hyve-api.vercel.app'

// Batch upserts to Supabase to avoid hitting payload size limits.
const BATCH_SIZE = 500

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ])
}

async function fetchJson<T>(url: string, ms = 30_000): Promise<T> {
  const r = await withTimeout(fetch(url, { cache: 'no-store' }), ms)
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`)
  return (await r.json()) as T
}

// PostgREST upsert with merge-duplicates Prefer header
async function upsertBatch(table: string, rows: unknown[]): Promise<void> {
  if (rows.length === 0) return
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const r = await supaPost(table, batch, 'resolution=merge-duplicates,return=minimal')
    if (!r.ok) {
      const detail = await r.text()
      throw new Error(`${table} batch ${i}: ${r.status} ${detail.slice(0, 200)}`)
    }
  }
}

async function recordSyncMeta(
  source: string,
  rowCount: number,
  status: 'ok' | 'failed',
  error?: string,
): Promise<void> {
  // Try patch first, fall back to insert (upsert pattern via merge-duplicates)
  await supaPost(
    'live_sync_meta',
    {
      source,
      last_synced: new Date().toISOString(),
      row_count: rowCount,
      status,
      error: error?.slice(0, 500) ?? null,
    },
    'resolution=merge-duplicates,return=minimal',
  )
}

// ── Source syncers ──────────────────────────────────────────────────────

async function syncCameras(): Promise<number> {
  type RawCam = {
    id: string
    label?: string
    source?: string
    feedUrl?: string
    feedType?: string
    agency?: string
    city?: string
    state?: string
    lat?: number
    lng?: number
    isPtzControllable?: boolean
  }
  const data = await fetchJson<RawCam[] | { cameras: RawCam[] }>(
    `${HYVE_API}/cameras/nearby?lat=39.8&lng=-98.5&radius=5000`,
  )
  const cams = Array.isArray(data) ? data : (data.cameras ?? [])
  const rows = cams
    .filter((c) => typeof c.lat === 'number' && typeof c.lng === 'number')
    .map((c) => ({
      id: c.id,
      label: c.label ?? null,
      source: c.source ?? null,
      feed_url: c.feedUrl ?? null,
      feed_type: c.feedType ?? null,
      agency: c.agency ?? null,
      city: c.city ?? null,
      state: c.state ?? null,
      lat: c.lat,
      lng: c.lng,
      is_ptz: c.isPtzControllable ?? false,
      raw: c,
      last_updated: new Date().toISOString(),
    }))
  await upsertBatch('live_cameras', rows)
  return rows.length
}

async function syncFeeds(): Promise<number> {
  type RawFeed = {
    id: string
    name?: string
    agency?: string
    type?: string
    feedType?: string
    county?: string
    state?: string
    lat?: number
    lng?: number
    streamUrl?: string
    listeners?: number
    listenerCount?: number
  }
  const data = await fetchJson<RawFeed[] | { feeds: RawFeed[] }>(
    `${HYVE_API}/feeds/trending?limit=5000`,
  )
  const feeds = Array.isArray(data) ? data : (data.feeds ?? [])
  const rows = feeds.map((f) => ({
    id: f.id,
    name: f.name ?? null,
    agency: f.agency ?? null,
    type: f.type ?? null,
    feed_type: f.feedType ?? null,
    county: f.county ?? null,
    state: f.state ?? null,
    lat: f.lat ?? null,
    lng: f.lng ?? null,
    stream_url: f.streamUrl ?? null,
    listeners: f.listeners ?? f.listenerCount ?? 0,
    raw: f,
    last_updated: new Date().toISOString(),
  }))
  await upsertBatch('live_feeds', rows)
  return rows.length
}

async function syncCrime(): Promise<number> {
  type RawCrime = {
    id: string
    city?: string
    state?: string
    category?: string
    subcategory?: string
    description?: string
    lat?: number
    lng?: number
    occurred_at?: string
  }
  const data = await fetchJson<RawCrime[] | { incidents: RawCrime[] }>(
    `${HYVE_API}/crime/incidents?limit=20000`,
  )
  const crimes = Array.isArray(data) ? data : (data.incidents ?? [])
  const rows = crimes
    .filter((c) => typeof c.lat === 'number' && typeof c.lng === 'number')
    .map((c) => ({
      id: c.id,
      city: c.city ?? null,
      state: c.state ?? null,
      category: c.category ?? null,
      subcategory: c.subcategory ?? null,
      description: c.description ?? null,
      lat: c.lat,
      lng: c.lng,
      occurred_at: c.occurred_at ?? null,
      raw: c,
      last_updated: new Date().toISOString(),
    }))
  await upsertBatch('live_crime_incidents', rows)
  return rows.length
}

// ── Endpoint ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = req.headers.get('Authorization')
  const got = auth?.startsWith('Bearer ') ? auth.slice(7) : ''
  // Vercel's own scheduled cron sends `Authorization: Bearer <CRON_SECRET>`;
  // also allow x-vercel-cron header pattern.
  const isVercelCron = req.headers.get('x-vercel-cron') === '1'
  if (!isVercelCron && (!CRON_SECRET || got !== CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const start = Date.now()
  const [camRes, feedRes, crimeRes] = await Promise.allSettled([
    syncCameras(),
    syncFeeds(),
    syncCrime(),
  ])

  const results: Record<string, { rows: number; status: 'ok' | 'failed'; error?: string }> = {
    cameras: camRes.status === 'fulfilled'
      ? { rows: camRes.value, status: 'ok' }
      : { rows: 0, status: 'failed', error: String(camRes.reason).slice(0, 200) },
    feeds: feedRes.status === 'fulfilled'
      ? { rows: feedRes.value, status: 'ok' }
      : { rows: 0, status: 'failed', error: String(feedRes.reason).slice(0, 200) },
    crime: crimeRes.status === 'fulfilled'
      ? { rows: crimeRes.value, status: 'ok' }
      : { rows: 0, status: 'failed', error: String(crimeRes.reason).slice(0, 200) },
  }

  // Record sync metadata — fire and forget, don't block response
  await Promise.allSettled([
    recordSyncMeta('cameras', results.cameras.rows, results.cameras.status, results.cameras.error),
    recordSyncMeta('feeds', results.feeds.rows, results.feeds.status, results.feeds.error),
    recordSyncMeta('crime', results.crime.rows, results.crime.status, results.crime.error),
  ])

  return NextResponse.json({
    ok: true,
    elapsed_ms: Date.now() - start,
    ...results,
  })
}
