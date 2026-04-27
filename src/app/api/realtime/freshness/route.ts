// GET /api/realtime/freshness
//
// Edge-cached passthrough to /cron/cameras-freshness. Aggregated stats —
// cache for 60s.

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const HYVE_API = 'https://hyve-api.vercel.app'
const CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' }

export async function GET() {
  try {
    const r = await fetch(`${HYVE_API}/cron/cameras-freshness`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    if (!r.ok) {
      return NextResponse.json({ error: 'upstream', status: r.status }, { status: 502 })
    }
    const data = await r.json()
    return NextResponse.json(data, { headers: CACHE_HEADERS })
  } catch (e) {
    return NextResponse.json(
      { error: 'fetch_failed', detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    )
  }
}
