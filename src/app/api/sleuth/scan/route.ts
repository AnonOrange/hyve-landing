// POST /api/sleuth/scan
//
// Enqueue a new OSINT scan. The hyve-sleuth-worker (Railway) polls
// sleuth_scan_jobs WHERE status='pending'.
//
// Body shape:
//   {
//     queryType: 'name' | 'email' | 'phone' | 'username' | 'address',
//     queryValue: string,
//     queryFirst?: string,    // optional, for queryType='name'
//     queryLast?: string,
//     queryState?: string,    // 2-letter US state hint
//     queryCity?: string,
//     sourceFilter?: string[] | null
//   }
//
// Response: { id, status, createdAt }

import { NextRequest, NextResponse } from 'next/server'
import { supaPost, supaGet } from '@/lib/supabase'
import { getSleuthUser } from '@/lib/sleuth/auth'

export const dynamic = 'force-dynamic'

const VALID_QUERY_TYPES = new Set(['name', 'email', 'phone', 'username', 'address'])

export async function POST(req: NextRequest) {
  const user = await getSleuthUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const queryType = String(body.queryType || '').trim().toLowerCase()
  const queryValue = String(body.queryValue || '').trim()
  const queryFirst = body.queryFirst ? String(body.queryFirst).trim() : null
  const queryLast = body.queryLast ? String(body.queryLast).trim() : null
  const queryState = body.queryState ? String(body.queryState).trim().toUpperCase() : null
  const queryCity = body.queryCity ? String(body.queryCity).trim() : null
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

  // Light rate-limit — cap inflight scans per user at 3
  const inflightR = await supaGet(
    'sleuth_scan_jobs',
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

  // Auto-parse name into first/last when queryType=name and they didn't supply
  let qFirst = queryFirst
  let qLast = queryLast
  if (queryType === 'name' && !qFirst && !qLast && queryValue.includes(' ')) {
    const parts = queryValue.split(/\s+/).filter(Boolean)
    qFirst = parts[0]
    qLast = parts[parts.length - 1]
  }

  const r = await supaPost('sleuth_scan_jobs', {
    user_email: user.email,
    status: 'pending',
    query_type: queryType,
    query_value: queryValue,
    query_first: qFirst,
    query_last: qLast,
    query_state: queryState,
    query_city: queryCity,
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
