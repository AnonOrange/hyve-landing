// GET /api/realtime/crime?lat=X&lng=Y&radius_mi=R&since_hours=H&limit=N
//
// Geo + time filtered crime incidents. Defaults to last 24h.

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
  const sinceHours = Math.min(168, Math.max(1, parseFloat(searchParams.get('since_hours') || '24')))
  const limit = Math.min(5000, parseInt(searchParams.get('limit') || '1000', 10))

  const sinceIso = new Date(Date.now() - sinceHours * 3600_000).toISOString()
  let query =
    `select=id,city,state,category,subcategory,description,lat,lng,occurred_at,last_updated` +
    `&occurred_at=gte.${encodeURIComponent(sinceIso)}` +
    `&order=occurred_at.desc&limit=${limit}`

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const b = bbox(lat, lng, radiusMi)
    query += `&lat=gte.${b.minLat}&lat=lte.${b.maxLat}&lng=gte.${b.minLng}&lng=lte.${b.maxLng}`
  }

  const r = await supaGet('live_crime_incidents', query)
  if (!r.ok) {
    return NextResponse.json({ error: 'lookup_failed' }, { status: 502 })
  }
  const rows = (await r.json()) as Array<Record<string, unknown>>

  const meta = await supaGet('live_sync_meta', `source=eq.crime&select=last_synced,row_count`)
  let lastSynced: string | null = null
  let totalRows = 0
  if (meta.ok) {
    const r = (await meta.json()) as Array<{ last_synced: string; row_count: number }>
    if (r[0]) { lastSynced = r[0].last_synced; totalRows = r[0].row_count }
  }

  return NextResponse.json(
    {
      incidents: rows,
      count: rows.length,
      total_in_cache: totalRows,
      last_synced: lastSynced,
      since_hours: sinceHours,
    },
    { headers: CACHE_HEADERS },
  )
}
