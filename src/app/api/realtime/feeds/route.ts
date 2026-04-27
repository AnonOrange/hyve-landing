// GET /api/realtime/feeds?lat=X&lng=Y&radius_mi=R&limit=N
//
// Geo-filtered scanner feeds, sorted by listener count desc.

import { NextRequest, NextResponse } from 'next/server'
import { supaGet } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
}

function bbox(lat: number, lng: number, radiusMi: number) {
  const dLat = radiusMi / 69
  const dLng = radiusMi / (69 * Math.max(0.01, Math.cos((lat * Math.PI) / 180)))
  return {
    minLat: lat - dLat,
    maxLat: lat + dLat,
    minLng: lng - dLng,
    maxLng: lng + dLng,
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const lat = parseFloat(searchParams.get('lat') || '')
  const lng = parseFloat(searchParams.get('lng') || '')
  const radiusMi = Math.min(5000, parseFloat(searchParams.get('radius_mi') || '50'))
  const limit = Math.min(2000, parseInt(searchParams.get('limit') || '500', 10))

  let query = `select=id,name,agency,type,feed_type,county,state,lat,lng,stream_url,listeners,last_updated&order=listeners.desc&limit=${limit}`

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const b = bbox(lat, lng, radiusMi)
    query += `&lat=gte.${b.minLat}&lat=lte.${b.maxLat}&lng=gte.${b.minLng}&lng=lte.${b.maxLng}`
  }

  const r = await supaGet('live_feeds', query)
  if (!r.ok) {
    return NextResponse.json({ error: 'lookup_failed' }, { status: 502 })
  }
  const rows = (await r.json()) as Array<Record<string, unknown>>

  const feeds = rows.map((f) => ({
    id: f.id,
    name: f.name,
    agency: f.agency,
    type: f.type,
    feedType: f.feed_type,
    county: f.county,
    state: f.state,
    lat: f.lat,
    lng: f.lng,
    streamUrl: f.stream_url,
    listeners: f.listeners,
    lastUpdated: f.last_updated,
  }))

  const meta = await supaGet('live_sync_meta', `source=eq.feeds&select=last_synced,row_count`)
  let lastSynced: string | null = null
  let totalRows = 0
  if (meta.ok) {
    const r = (await meta.json()) as Array<{ last_synced: string; row_count: number }>
    if (r[0]) { lastSynced = r[0].last_synced; totalRows = r[0].row_count }
  }

  return NextResponse.json(
    { feeds, count: feeds.length, total_in_cache: totalRows, last_synced: lastSynced },
    { headers: CACHE_HEADERS },
  )
}
