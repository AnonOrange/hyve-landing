// GET /api/realtime/summarize/[id]
//
// Edge-cached passthrough to AI summary endpoint. Forward auth headers
// since the upstream may require them.

import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const HYVE_API = 'https://hyve-api.vercel.app'
const CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' }

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const id = ctx.params.id
  if (!id || id.length > 100) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  }
  const fwdHeaders: HeadersInit = {}
  const auth = req.headers.get('Authorization')
  if (auth) (fwdHeaders as Record<string, string>).Authorization = auth

  try {
    const r = await fetch(`${HYVE_API}/summarize/${encodeURIComponent(id)}`, {
      cache: 'no-store',
      headers: fwdHeaders,
      signal: AbortSignal.timeout(30_000),
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
