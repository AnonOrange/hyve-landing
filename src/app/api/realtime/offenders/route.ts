// GET /api/realtime/offenders?lat=X&lng=Y&radius_mi=R&limit=N&state=NC
//
// Sex offender registry markers. Geo-filtered for fast page loads.

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
  const limit = Math.min(5000, parseInt(searchParams.get('limit') || '2000', 10))
  const state = searchParams.get('state')

  let query = `select=id,label,source,feed_url,agency,state,county,lat,lng,details,last_updated&limit=${limit}`
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const b = bbox(lat, lng, radiusMi)
    query += `&lat=gte.${b.minLat}&lat=lte.${b.maxLat}&lng=gte.${b.minLng}&lng=lte.${b.maxLng}`
  }
  if (state) query += `&state=eq.${encodeURIComponent(state.toUpperCase())}`

  const r = await supaGet('live_offenders', query)
  if (!r.ok) return NextResponse.json({ error: 'lookup_failed' }, { status: 502 })
  const rows = (await r.json()) as Array<Record<string, unknown>>

  // Match the upstream /cameras/offenders shape so consumer pages work unchanged
  const offenders = rows.map((o) => ({
    id: o.id,
    label: o.label,
    source: o.source,
    feedUrl: o.feed_url,
    feedType: 'offender',
    agency: o.agency,
    state: o.state,
    county: o.county,
    lat: o.lat,
    lng: o.lng,
    details: o.details,
    lastUpdated: o.last_updated,
  }))

  const meta = await supaGet('live_sync_meta', `source=eq.offenders&select=last_synced,row_count`)
  let lastSynced: string | null = null
  let totalRows = 0
  if (meta.ok) {
    const r2 = (await meta.json()) as Array<{ last_synced: string; row_count: number }>
    if (r2[0]) { lastSynced = r2[0].last_synced; totalRows = r2[0].row_count }
  }

  return NextResponse.json(
    { offenders, count: offenders.length, total_in_cache: totalRows, last_synced: lastSynced },
    { headers: CACHE_HEADERS },
  )
}
