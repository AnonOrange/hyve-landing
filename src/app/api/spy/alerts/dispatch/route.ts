import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'

const SUPA_URL = process.env.SUPABASE_URL
const SUPA_SERVICE = process.env.SUPABASE_SERVICE_KEY
const VAPID_PUB = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PRIV = process.env.VAPID_PRIVATE_KEY
const AGENT_SECRET = process.env.HYVE_API_AGENT_SECRET

if (VAPID_PUB && VAPID_PRIV) {
  webpush.setVapidDetails('mailto:noreply@hyveapp.co', VAPID_PUB, VAPID_PRIV)
}

function haversineMi(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180
  const R = 3958.8 // miles
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// POST /api/spy/alerts/dispatch — fired by hyve-api when an incident is detected.
// Body: { alertId, feedId, lat, lng, severity, title, body, agency }
// Auth: X-Agent-Secret header (same secret as hyve-api admin/agent endpoints)
export async function POST(req: NextRequest) {
  const got = req.headers.get('x-agent-secret') || ''
  if (!AGENT_SECRET || got !== AGENT_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!SUPA_URL || !SUPA_SERVICE) {
    return NextResponse.json({ error: 'no_db' }, { status: 503 })
  }

  const alert = await req.json().catch(() => ({}))
  const { alertId, lat, lng, severity = 'any' } = alert
  if (!alertId || typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json({ error: 'alertId, lat, lng required' }, { status: 400 })
  }

  // Pull all enabled subscriptions with a saved location.
  // (For scale: use PostGIS earthdistance later — for now linear scan is fine up to ~10k subs.)
  const subRes = await fetch(
    `${SUPA_URL}/rest/v1/alert_subscriptions?enabled=eq.true&lat=not.is.null&lng=not.is.null&select=*`,
    { headers: { apikey: SUPA_SERVICE, Authorization: `Bearer ${SUPA_SERVICE}` } },
  )
  if (!subRes.ok) {
    return NextResponse.json({ error: 'sub_fetch_failed' }, { status: 502 })
  }
  const subs = await subRes.json()

  const now = new Date()
  const localHour = now.getUTCHours() // crude — caller provides quiet hours in UTC for simplicity
  const eligible = (subs as any[]).filter((s) => {
    if (s.min_severity === 'critical' && severity !== 'critical') return false
    if (s.quiet_start != null && s.quiet_end != null) {
      const inQuiet = s.quiet_start <= s.quiet_end
        ? localHour >= s.quiet_start && localHour < s.quiet_end
        : localHour >= s.quiet_start || localHour < s.quiet_end
      if (inQuiet && severity !== 'critical') return false
    }
    const distance = haversineMi(s.lat, s.lng, lat, lng)
    return distance <= (s.radius_mi || 10)
  })

  const payload = JSON.stringify({
    title: alert.title || '🚨 Hyve Spy alert',
    body: alert.body || `Incident detected ${alert.agency ? 'on ' + alert.agency : 'nearby'}`,
    feedId: alert.feedId,
    lat,
    lng,
    severity,
  })

  const results = await Promise.allSettled(
    eligible.map(async (s) => {
      // Web push
      if (s.push_endpoint && s.push_p256dh && s.push_auth) {
        try {
          await webpush.sendNotification(
            { endpoint: s.push_endpoint, keys: { p256dh: s.push_p256dh, auth: s.push_auth } },
            payload,
            { TTL: 600 },
          )
          await fetch(`${SUPA_URL}/rest/v1/alert_deliveries`, {
            method: 'POST',
            headers: { apikey: SUPA_SERVICE!, Authorization: `Bearer ${SUPA_SERVICE}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ alert_id: alertId, user_id: s.user_id, channel: 'web', status: 'ok' }),
          })
        } catch (e: any) {
          await fetch(`${SUPA_URL}/rest/v1/alert_deliveries`, {
            method: 'POST',
            headers: { apikey: SUPA_SERVICE!, Authorization: `Bearer ${SUPA_SERVICE}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ alert_id: alertId, user_id: s.user_id, channel: 'web', status: 'error', error: String(e.message || e).slice(0, 300) }),
          })
        }
      }
      // FCM placeholder — actual FCM Admin SDK call goes here when we wire it
      return s.user_id
    }),
  )

  const ok = results.filter((r) => r.status === 'fulfilled').length
  return NextResponse.json({
    ok: true,
    alertId,
    candidateSubs: subs.length,
    eligible: eligible.length,
    delivered: ok,
  })
}

export const dynamic = 'force-dynamic'
