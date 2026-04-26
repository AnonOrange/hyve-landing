import { NextRequest, NextResponse } from 'next/server'
import { getSpyUser } from '@/lib/spyAuth'

const SUPA_URL = process.env.SUPABASE_URL
const SUPA_SERVICE = process.env.SUPABASE_SERVICE_KEY

// POST /api/spy/alerts/subscribe — body shape:
// { endpoint, p256dh, auth, lat, lng, radiusMi, minSeverity, quietStart, quietEnd, enabled }
export async function POST(req: NextRequest) {
  if (!SUPA_URL || !SUPA_SERVICE) return NextResponse.json({ error: 'no_db' }, { status: 503 })

  const user = await getSpyUser()
  // Anonymous subscriptions are allowed (keyed by endpoint) — no JWT required
  const body = await req.json().catch(() => ({}))
  const userId = user?.sub || `anon-${(body.endpoint || '').slice(-32) || Date.now()}`

  const row = {
    user_id: userId,
    email: user?.email || null,
    push_endpoint: body.endpoint || null,
    push_p256dh: body.p256dh || null,
    push_auth: body.auth || null,
    fcm_token: body.fcmToken || null,
    lat: typeof body.lat === 'number' ? body.lat : null,
    lng: typeof body.lng === 'number' ? body.lng : null,
    radius_mi: typeof body.radiusMi === 'number' ? Math.max(1, Math.min(50, body.radiusMi)) : 10,
    min_severity: body.minSeverity || 'any',
    quiet_start: typeof body.quietStart === 'number' ? body.quietStart : null,
    quiet_end: typeof body.quietEnd === 'number' ? body.quietEnd : null,
    enabled: body.enabled !== false,
    updated_at: new Date().toISOString(),
  }

  const r = await fetch(`${SUPA_URL}/rest/v1/alert_subscriptions`, {
    method: 'POST',
    headers: {
      apikey: SUPA_SERVICE,
      Authorization: `Bearer ${SUPA_SERVICE}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(row),
  })

  if (!r.ok) {
    const t = await r.text()
    return NextResponse.json({ error: t.slice(0, 300) }, { status: 502 })
  }
  return NextResponse.json({ ok: true, userId })
}

// DELETE /api/spy/alerts/subscribe?userId=... — unsubscribe
export async function DELETE(req: NextRequest) {
  if (!SUPA_URL || !SUPA_SERVICE) return NextResponse.json({ error: 'no_db' }, { status: 503 })
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId_required' }, { status: 400 })
  await fetch(`${SUPA_URL}/rest/v1/alert_subscriptions?user_id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPA_SERVICE,
      Authorization: `Bearer ${SUPA_SERVICE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ enabled: false, updated_at: new Date().toISOString() }),
  })
  return NextResponse.json({ ok: true })
}

export const dynamic = 'force-dynamic'
