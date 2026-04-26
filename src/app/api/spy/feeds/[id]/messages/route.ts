import { NextRequest, NextResponse } from 'next/server'
import { getSpyUser } from '@/lib/spyAuth'

const SUPA_URL = process.env.SUPABASE_URL
const SUPA_SERVICE = process.env.SUPABASE_SERVICE_KEY

const MAX_BODY = 500
const RATE_LIMIT_PER_MIN = 10

async function supa(path: string, init: RequestInit = {}) {
  if (!SUPA_URL || !SUPA_SERVICE) throw new Error('supabase_not_configured')
  const r = await fetch(`${SUPA_URL}${path}`, {
    ...init,
    headers: {
      apikey: SUPA_SERVICE,
      Authorization: `Bearer ${SUPA_SERVICE}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    cache: 'no-store',
  })
  return r
}

// GET /api/spy/feeds/{id}/messages?since=<id> — returns recent messages for a feed.
// Read is open (anyone with a valid hyve_spy_session can poll); write requires sign-in.
export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const feedId = ctx.params.id
  if (!feedId) return NextResponse.json({ error: 'no_feed_id' }, { status: 400 })

  const session = req.cookies.get('hyve_spy_session')?.value
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const sinceParam = req.nextUrl.searchParams.get('since') // numeric id
  const sinceFilter = sinceParam ? `&id=gt.${encodeURIComponent(sinceParam)}` : ''
  // Default: last 50 messages, newest first
  const limit = sinceParam ? '100' : '50'
  const r = await supa(
    `/rest/v1/feed_messages?feed_id=eq.${encodeURIComponent(feedId)}${sinceFilter}&order=id.desc&limit=${limit}&select=id,user_id,email,display,body,created_at`,
  )
  if (!r.ok) {
    const t = await r.text()
    return NextResponse.json({ error: t.slice(0, 200) }, { status: 502 })
  }
  const rows = await r.json()
  // Reverse to chronological for the UI
  return NextResponse.json({ messages: rows.reverse() })
}

// POST /api/spy/feeds/{id}/messages — body: { body, display? }
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const feedId = ctx.params.id
  if (!feedId) return NextResponse.json({ error: 'no_feed_id' }, { status: 400 })

  const user = await getSpyUser()
  if (!user) return NextResponse.json({ error: 'sign_in_required' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const text = String(body.body || '').trim().slice(0, MAX_BODY)
  if (!text) return NextResponse.json({ error: 'empty_body' }, { status: 400 })

  // Rate limit: count this user's posts in the last 60s
  const since = new Date(Date.now() - 60_000).toISOString()
  const rateCheck = await supa(
    `/rest/v1/feed_messages?user_id=eq.${user.sub}&created_at=gte.${encodeURIComponent(since)}&select=id`,
    { headers: { Prefer: 'count=exact' } },
  )
  const rangeHeader = rateCheck.headers.get('content-range') || '0-0/0'
  const count = parseInt(rangeHeader.split('/')[1] || '0', 10)
  if (count >= RATE_LIMIT_PER_MIN) {
    return NextResponse.json({ error: 'rate_limited', retry_after_s: 60 }, { status: 429 })
  }

  const ins = await supa('/rest/v1/feed_messages', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      feed_id: feedId,
      user_id: user.sub,
      email: user.email,
      display: typeof body.display === 'string' ? body.display.slice(0, 32) : null,
      body: text,
    }),
  })
  if (!ins.ok) {
    const t = await ins.text()
    return NextResponse.json({ error: t.slice(0, 200) }, { status: 502 })
  }
  const inserted = await ins.json()
  return NextResponse.json({ message: Array.isArray(inserted) ? inserted[0] : inserted })
}
