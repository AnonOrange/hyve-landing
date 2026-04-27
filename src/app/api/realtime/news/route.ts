// GET /api/realtime/news?lat=X&lng=Y&keyword=...
//
// Edge-cached passthrough to /news/related.

import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const HYVE_API = 'https://hyve-api.vercel.app'
const CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' }

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')
  if (!lat || !lng) {
    return NextResponse.json({ error: 'lat_lng_required' }, { status: 400 })
  }
  const keyword = searchParams.get('keyword') || ''
  const upstreamUrl = new URL(`${HYVE_API}/news/related`)
  upstreamUrl.searchParams.set('lat', lat)
  upstreamUrl.searchParams.set('lng', lng)
  if (keyword) upstreamUrl.searchParams.set('keyword', keyword)

  try {
    const r = await fetch(upstreamUrl.toString(), {
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
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
