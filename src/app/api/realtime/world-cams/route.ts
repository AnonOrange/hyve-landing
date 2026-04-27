// GET /api/realtime/world-cams?lat=X&lng=Y&radius_mi=R&limit=N&category=cruise-cam
//
// Worldwide cameras (Windy, cruise-port, curated). Optional category filter.

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
  const radiusMi = Math.min(15000, parseFloat(searchParams.get('radius_mi') || '500'))
  const limit = Math.min(5000, parseInt(searchParams.get('limit') || '1000', 10))
  const category = searchParams.get('category')

  let query = `select=id,label,source,feed_url,feed_type,agency,category,state,county,lat,lng,is_verified,is_ptz,thumbnail_url,last_updated&limit=${limit}`
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const b = bbox(lat, lng, radiusMi)
    query += `&lat=gte.${b.minLat}&lat=lte.${b.maxLat}&lng=gte.${b.minLng}&lng=lte.${b.maxLng}`
  }
  if (category) {
    query += `&feed_type=eq.${encodeURIComponent(category)}`
  }

  const r = await supaGet('live_world_cameras', query)
  if (!r.ok) return NextResponse.json({ error: 'lookup_failed' }, { status: 502 })
  const rows = (await r.json()) as Array<Record<string, unknown>>

  const cameras = rows.map((c) => ({
    id: c.id,
    label: c.label,
    source: c.source,
    feedUrl: c.feed_url,
    feedType: c.feed_type,
    agency: c.agency,
    category: c.category,
    state: c.state,
    county: c.county,
    lat: c.lat,
    lng: c.lng,
    isVerified: c.is_verified,
    isPtzControllable: c.is_ptz,
    thumbnailUrl: c.thumbnail_url,
    lastUpdated: c.last_updated,
  }))

  const meta = await supaGet('live_sync_meta', `source=eq.world_cameras&select=last_synced,row_count`)
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
