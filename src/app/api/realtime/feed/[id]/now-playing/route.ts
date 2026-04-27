// GET /api/realtime/feed/[id]/now-playing
//
// Edge-cached passthrough. Updates frequently (~3s) so cache TTL is short.

import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const HYVE_API = 'https://hyve-api.vercel.app'
const CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15' }

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const id = ctx.params.id
  if (!id || id.length > 100) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  }
  try {
    const r = await fetch(`${HYVE_API}/feeds/${encodeURIComponent(id)}/now-playing`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
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
