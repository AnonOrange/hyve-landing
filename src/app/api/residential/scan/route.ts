// POST /api/residential/scan
//
// Enqueue a new distress-property scan. The Railway worker polls
// residential_scan_jobs WHERE status='pending' and picks it up.
//
// Body shape:
//   {
//     queryType: 'address' | 'city' | 'county' | 'zip' | 'state',
//     queryValue: string,
//     queryState?: string,           // 2-letter US state code (NC, FL, etc)
//     sourceFilter?: string[] | null // optional adapter allowlist
//                                    // null/undefined = run all federal sources
//   }
//
// Response: { id: string, status: 'pending', createdAt: string }

import { NextRequest, NextResponse } from 'next/server'
import { supaPost } from '@/lib/supabase'
import { getResidentialUser } from '@/lib/residential/auth'

export const dynamic = 'force-dynamic'

const VALID_QUERY_TYPES = new Set(['address', 'city', 'county', 'zip', 'state'])

export async function POST(req: NextRequest) {
  const user = await getResidentialUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const queryType = String(body.queryType || '').trim().toLowerCase()
  const queryValue = String(body.queryValue || '').trim()
  const queryState = body.queryState ? String(body.queryState).trim().toUpperCase() : null
  const sourceFilter = Array.isArray(body.sourceFilter) && body.sourceFilter.length > 0
    ? body.sourceFilter.map((s: unknown) => String(s).trim().toUpperCase())
    : null

  if (!VALID_QUERY_TYPES.has(queryType)) {
    return NextResponse.json({ error: 'invalid_query_type' }, { status: 400 })
  }
  if (!queryValue || queryValue.length > 200) {
    return NextResponse.json({ error: 'invalid_query_value' }, { status: 400 })
  }
  if (queryState && !/^[A-Z]{2}$/.test(queryState)) {
    return NextResponse.json({ error: 'invalid_state' }, { status: 400 })
  }

  // Rate limit: cap pending+running scans per user at 3 (prevents queue floods)
  const { supaGet } = await import('@/lib/supabase')
  const inflightR = await supaGet(
    'residential_scan_jobs',
    `user_email=eq.${encodeURIComponent(user.email)}&status=in.(pending,running)&select=id`,
  )
  if (inflightR.ok) {
    const inflight = (await inflightR.json()) as Array<{ id: string }>
    if (inflight.length >= 3) {
      return NextResponse.json(
        { error: 'too_many_inflight', detail: 'You have 3 scans queued or running. Wait for one to finish.' },
        { status: 429 },
      )
    }
  }

  const r = await supaPost('residential_scan_jobs', {
    user_email: user.email,
    status: 'pending',
    query_type: queryType,
    query_value: queryValue,
    query_state: queryState,
    source_filter: sourceFilter,
    progress: {},
  })
  if (!r.ok) {
    const detail = await r.text()
    return NextResponse.json({ error: 'enqueue_failed', detail }, { status: 502 })
  }
  const rows = (await r.json()) as Array<{ id: string; created_at: string; status: string }>
  const row = rows[0]
  return NextResponse.json({
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
  })
}
