import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const COMP_EMAILS = new Set([
  'vibesoftwaresolutions@gmail.com',
  'luckybstudios@gmail.com',
])

const SUPA_URL = process.env.SUPABASE_URL
const SUPA_SERVICE = process.env.SUPABASE_SERVICE_KEY

function authorize() {
  const session = cookies().get('hyve_spy_session')?.value || ''
  const email = session.startsWith('comp:')
    ? decodeURIComponent(session.slice('comp:'.length)).toLowerCase()
    : null
  return email && COMP_EMAILS.has(email) ? email : null
}

// POST /api/spy/admin/recon/add — body: { url, label, lat, lng, type? }
export async function POST(req: NextRequest) {
  const email = authorize()
  if (!email) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (!SUPA_URL || !SUPA_SERVICE) return NextResponse.json({ error: 'no_db' }, { status: 503 })

  const body = await req.json().catch(() => ({}))
  const url = String(body.url || '').trim()
  const label = String(body.label || '').trim() || 'Recon (manual)'
  const lat = Number(body.lat)
  const lng = Number(body.lng)
  const feedType = (body.type || 'snapshot').toString()

  if (!url) return NextResponse.json({ error: 'url_required' }, { status: 400 })
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'lat_lng_required' }, { status: 400 })
  }

  const id = `recon-manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const row = {
    id,
    label,
    agency: 'Manual',
    feed_type: feedType,
    feed_url: url,
    source: `manual:${email}`,
    lat,
    lng,
    is_active: true,
    is_verified: false,
    confidence: 0.5,
    classification: 'recon',
    region: 'recon',
    last_seen_alive: new Date().toISOString(),
  }
  const r = await fetch(`${SUPA_URL}/rest/v1/cameras`, {
    method: 'POST',
    headers: {
      apikey: SUPA_SERVICE,
      Authorization: `Bearer ${SUPA_SERVICE}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(row),
  })
  if (!r.ok) {
    const t = await r.text()
    return NextResponse.json({ error: t.slice(0, 300) }, { status: 502 })
  }
  return NextResponse.json({ ok: true, id })
}

// DELETE /api/spy/admin/recon/add?id=... — remove a manually-added recon camera
export async function DELETE(req: NextRequest) {
  const email = authorize()
  if (!email) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (!SUPA_URL || !SUPA_SERVICE) return NextResponse.json({ error: 'no_db' }, { status: 503 })
  const id = req.nextUrl.searchParams.get('id') || ''
  if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 })
  const r = await fetch(
    `${SUPA_URL}/rest/v1/cameras?id=eq.${encodeURIComponent(id)}&region=eq.recon`,
    {
      method: 'DELETE',
      headers: { apikey: SUPA_SERVICE, Authorization: `Bearer ${SUPA_SERVICE}` },
    },
  )
  if (!r.ok) return NextResponse.json({ error: 'delete_failed' }, { status: 502 })
  return NextResponse.json({ ok: true })
}

export const dynamic = 'force-dynamic'
