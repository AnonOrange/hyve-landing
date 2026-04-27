// Cold realtime sync — heavy + slowly-changing datasets:
//   /cameras/world         (10 MB)
//   /cameras/offenders     (55 MB)
//   /cameras/surveillance  (67 MB)
//
// Triggered by the Railway worker every 5 minutes (vs 1 min for hot data).
// Same auth pattern as /api/cron/realtime-sync.

import { NextRequest, NextResponse } from 'next/server'
import { supaPost } from '@/lib/supabase'

export const runtime = 'nodejs'
export const maxDuration = 300         // up to 5 min — these are LARGE
export const dynamic = 'force-dynamic'

const CRON_SECRET = process.env.CRON_SECRET
const HYVE_API = 'https://hyve-api.vercel.app'
const BATCH_SIZE = 500

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))])
}

async function fetchJson<T>(url: string, ms = 120_000): Promise<T> {
  const r = await withTimeout(fetch(url, { cache: 'no-store' }), ms)
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`)
  return (await r.json()) as T
}

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

async function recordSyncMeta(source: string, rowCount: number, status: 'ok' | 'failed', error?: string): Promise<void> {
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

type RawCam = {
  id: string
  label?: string
  source?: string
  feedUrl?: string
  feedType?: string
  agency?: string
  category?: string
  state?: string
  county?: string
  lat?: number
  lng?: number
  isVerified?: boolean
  isPtzControllable?: boolean
  thumbnailUrl?: string
  details?: unknown
  surveillance_type?: string
}

async function syncWorldCameras(): Promise<number> {
  const cams = await fetchJson<RawCam[]>(`${HYVE_API}/cameras/world`)
  const rows = cams
    .filter((c) => typeof c.lat === 'number' && typeof c.lng === 'number')
    .map((c) => ({
      id: c.id,
      label: c.label ?? null,
      source: c.source ?? null,
      feed_url: c.feedUrl ?? null,
      feed_type: c.feedType ?? null,
      agency: c.agency ?? null,
      category: c.category ?? null,
      state: c.state ?? null,
      county: c.county ?? null,
      lat: c.lat,
      lng: c.lng,
      is_verified: c.isVerified ?? false,
      is_ptz: c.isPtzControllable ?? false,
      thumbnail_url: c.thumbnailUrl ?? null,
      raw: c,
      last_updated: new Date().toISOString(),
    }))
  await upsertBatch('live_world_cameras', rows)
  return rows.length
}

async function syncOffenders(): Promise<number> {
  const offenders = await fetchJson<RawCam[]>(`${HYVE_API}/cameras/offenders`)
  const rows = offenders
    .filter((o) => typeof o.lat === 'number' && typeof o.lng === 'number')
    .map((o) => ({
      id: o.id,
      label: o.label ?? null,
      source: o.source ?? null,
      feed_url: o.feedUrl ?? null,
      agency: o.agency ?? null,
      state: o.state ?? null,
      county: o.county ?? null,
      lat: o.lat,
      lng: o.lng,
      details: o.details ?? null,
      raw: o,
      last_updated: new Date().toISOString(),
    }))
  await upsertBatch('live_offenders', rows)
  return rows.length
}

async function syncSurveillance(): Promise<number> {
  const surv = await fetchJson<RawCam[]>(`${HYVE_API}/cameras/surveillance`)
  const rows = surv
    .filter((s) => typeof s.lat === 'number' && typeof s.lng === 'number')
    .map((s) => ({
      id: s.id,
      label: s.label ?? null,
      source: s.source ?? null,
      feed_url: s.feedUrl ?? null,
      feed_type: s.feedType ?? null,
      agency: s.agency ?? null,
      state: s.state ?? null,
      county: s.county ?? null,
      lat: s.lat,
      lng: s.lng,
      surveillance_type: s.surveillance_type ?? null,
      is_verified: s.isVerified ?? false,
      raw: s,
      last_updated: new Date().toISOString(),
    }))
  await upsertBatch('live_surveillance_cameras', rows)
  return rows.length
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('Authorization')
  const got = auth?.startsWith('Bearer ') ? auth.slice(7) : ''
  const isVercelCron = req.headers.get('x-vercel-cron') === '1'
  if (!isVercelCron && (!CRON_SECRET || got !== CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const start = Date.now()
  const [worldRes, offRes, survRes] = await Promise.allSettled([
    syncWorldCameras(),
    syncOffenders(),
    syncSurveillance(),
  ])

  const results = {
    world_cameras: worldRes.status === 'fulfilled'
      ? { rows: worldRes.value, status: 'ok' as const }
      : { rows: 0, status: 'failed' as const, error: String(worldRes.reason).slice(0, 200) },
    offenders: offRes.status === 'fulfilled'
      ? { rows: offRes.value, status: 'ok' as const }
      : { rows: 0, status: 'failed' as const, error: String(offRes.reason).slice(0, 200) },
    surveillance: survRes.status === 'fulfilled'
      ? { rows: survRes.value, status: 'ok' as const }
      : { rows: 0, status: 'failed' as const, error: String(survRes.reason).slice(0, 200) },
  }

  await Promise.allSettled([
    recordSyncMeta('world_cameras', results.world_cameras.rows, results.world_cameras.status, results.world_cameras.error),
    recordSyncMeta('offenders', results.offenders.rows, results.offenders.status, results.offenders.error),
    recordSyncMeta('surveillance', results.surveillance.rows, results.surveillance.status, results.surveillance.error),
  ])

  return NextResponse.json({ ok: true, elapsed_ms: Date.now() - start, ...results })
}
