import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const COMP_EMAILS = new Set([
  'vibesoftwaresolutions@gmail.com',
  'luckybstudios@gmail.com',
])

const SUPA_URL = process.env.SUPABASE_URL
const SUPA_SERVICE = process.env.SUPABASE_SERVICE_KEY

export async function GET(req: NextRequest) {
  const session = cookies().get('hyve_spy_session')?.value || ''
  const email = session.startsWith('comp:')
    ? decodeURIComponent(session.slice('comp:'.length)).toLowerCase()
    : null
  if (!email || !COMP_EMAILS.has(email)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (!SUPA_URL || !SUPA_SERVICE) {
    return NextResponse.json({ error: 'no_db' }, { status: 503 })
  }
  const r = await fetch(
    `${SUPA_URL}/rest/v1/cameras?region=eq.recon&is_active=eq.true&select=id,label,agency,feed_url,feed_type,lat,lng,state,county,confidence&limit=10000`,
    {
      headers: { apikey: SUPA_SERVICE, Authorization: `Bearer ${SUPA_SERVICE}` },
      cache: 'no-store',
    },
  )
  const rows = await r.json()
  return NextResponse.json({
    cameras: rows.map((r: any) => ({
      id: r.id,
      label: r.label,
      agency: r.agency,
      feedUrl: r.feed_url,
      feedType: r.feed_type,
      lat: r.lat,
      lng: r.lng,
      state: r.state,
      county: r.county,
    })),
  })
}

export const dynamic = 'force-dynamic'
