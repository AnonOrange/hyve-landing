// GET /api/realtime/cameras?lat=X&lng=Y&radius_mi=R&limit=N
//
// Returns cameras within `radius_mi` of (lat, lng), sliced to `limit`.
// Reads from the live_cameras table (populated every minute by
// /api/cron/realtime-sync). Tiny payload (50-200KB) replaces the 18MB
// full-CONUS download from hyve-api.vercel.app.
//
// If lat/lng aren't supplied, falls back to top `limit` cameras
// nationwide (for /spy/app/world-cams etc.).

import { NextRequest, NextResponse } from 'next/server'
import { supaGet } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// CDN cache: 30s edge cache lets multiple users share fetches
const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
}

function bbox(lat: number, lng: number, radiusMi: number) {
  // Quick lat/lng box for the supabase prefilter — final radius check
  // happens client-side via haversine. 1 deg lat ≈ 69 mi; 1 deg lng varies
  // with lat but using 69*cos(lat) is good enough for box prefiltering.
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

  let query = `select=id,label,source,feed_url,feed_type,agency,city,state,lat,lng,is_ptz,last_updated&limit=${limit}`

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const b = bbox(lat, lng, radiusMi)
    query += `&lat=gte.${b.minLat}&lat=lte.${b.maxLat}&lng=gte.${b.minLng}&lng=lte.${b.maxLng}`
  }

  const r = await supaGet('live_cameras', query)
  if (!r.ok) {
    return NextResponse.json({ error: 'lookup_failed' }, { status: 502 })
  }
  const rows = (await r.json()) as Array<Record<string, unknown>>

  const cameras = rows.map((c) => ({
    id: c.id,
    label: c.label,
    source: c.source,
    feedUrl: c.feed_url,
    feedType: c.feed_type,
    agency: c.agency,
    city: c.city,
    state: c.state,
    lat: c.lat,
    lng: c.lng,
    isPtzControllable: c.is_ptz,
    lastUpdated: c.last_updated,
  }))

  // Pull last sync time so client can show freshness
  const meta = await supaGet('live_sync_meta', `source=eq.cameras&select=last_synced,row_count`)
  let lastSynced: string | null = null
  let totalRows = 0
  if (meta.ok) {
    const rows = (await meta.json()) as Array<{ last_synced: string; row_count: number }>
    if (rows[0]) {
      lastSynced = rows[0].last_synced
      totalRows = rows[0].row_count
    }
  }

  return NextResponse.json(
    {
      cameras,
      count: cameras.length,
      total_in_cache: totalRows,
      last_synced: lastSynced,
    },
    { headers: CACHE_HEADERS },
  )
}
