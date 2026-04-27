// GET /api/sleuth/scans
//
// Returns the authenticated user's recent Sleuth scan history (last 50).
// Used by the scan-history sidebar at /spy/app/sleuth/scan.

import { NextRequest, NextResponse } from 'next/server'
import { supaGet } from '@/lib/supabase'
import { getSleuthUser } from '@/lib/sleuth/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getSleuthUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const r = await supaGet(
    'sleuth_scan_jobs',
    `user_email=eq.${encodeURIComponent(user.email)}&select=id,status,query_type,query_value,query_first,query_last,query_state,query_city,source_filter,created_at,started_at,completed_at,result_count,error,progress&order=created_at.desc&limit=50`,
  )
  if (!r.ok) return NextResponse.json({ error: 'lookup_failed' }, { status: 502 })
  const rows = (await r.json()) as Array<Record<string, unknown>>

  const scans = rows.map((s) => ({
    id: s.id as string,
    userEmail: user.email,
    status: s.status as string,
    queryType: s.query_type as string,
    queryValue: s.query_value as string,
    queryFirst: s.query_first as string | null,
    queryLast: s.query_last as string | null,
    queryState: s.query_state as string | null,
    queryCity: s.query_city as string | null,
    sourceFilter: s.source_filter as string[] | null,
    createdAt: s.created_at as string,
    startedAt: s.started_at as string | null,
    completedAt: s.completed_at as string | null,
    resultCount: (s.result_count as number) || 0,
    error: s.error as string | null,
    progress: (s.progress as Record<string, unknown>) || {},
  }))

  return NextResponse.json({ scans })
}
