// GET /api/realtime/surveillance?lat=X&lng=Y&radius_mi=R&limit=N&type=alpr-flock
//
// Public surveillance / ALPR camera markers (Flock, etc).

import { NextRequest, NextResponse } from 'next/server'
import { supaGet } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' }

function bbox(lat: number, lng: number, radiusMi: number) {
  const dLat = radiusMi / 69
  const dLng = radiusMi / (69 * Math.max(0.01, Math.cos((lat * Math.PI) / 180)))
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const lat = parseFloat(searchParams.get('lat') || '')
  const lng = parseFloat(searchParams.get('lng') || '')
  const radiusMi = Math.min(5000, parseFloat(searchParams.get('radius_mi') || '50'))
  const limit = Math.min(10000, parseInt(searchParams.get('limit') || '3000', 10))
  const surveillanceType = searchParams.get('type')

  let query = `select=id,label,source,feed_url,feed_type,agency,state,county,lat,lng,surveillance_type,is_verified,last_updated&limit=${limit}`
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const b = bbox(lat, lng, radiusMi)
    query += `&lat=gte.${b.minLat}&lat=lte.${b.maxLat}&lng=gte.${b.minLng}&lng=lte.${b.maxLng}`
  }
  if (surveillanceType) {
    query += `&surveillance_type=eq.${encodeURIComponent(surveillanceType)}`
  }

  const r = await supaGet('live_surveillance_cameras', query)
  if (!r.ok) return NextResponse.json({ error: 'lookup_failed' }, { status: 502 })
  const rows = (await r.json()) as Array<Record<string, unknown>>

  const cameras = rows.map((c) => ({
    id: c.id,
    label: c.label,
    source: c.source,
    feedUrl: c.feed_url,
    feedType: c.feed_type,
    agency: c.agency,
    state: c.state,
    county: c.county,
    lat: c.lat,
    lng: c.lng,
    surveillance_type: c.surveillance_type,
    isVerified: c.is_verified,
    lastUpdated: c.last_updated,
  }))

  const meta = await supaGet('live_sync_meta', `source=eq.surveillance&select=last_synced,row_count`)
  let lastSynced: string | null = null
  let totalRows = 0
  if (meta.ok) {
    const r2 = (await meta.json()) as Array<{ last_synced: string; row_count: number }>
    if (r2[0]) { lastSynced = r2[0].last_synced; totalRows = r2[0].row_count }
  }

  return NextResponse.json(
    { cameras, count: cameras.length, total_in_cache: totalRows, last_synced: lastSynced },
    { headers: CACHE_HEADERS },
  )
}
