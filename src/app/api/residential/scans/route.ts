// GET /api/residential/scans
//
// Returns the authenticated user's recent scan history (last 50). Used by
// the scan-history sidebar / dropdown on /spy/app/residential.
//
// Response: { scans: ScanJob[] }

import { NextRequest, NextResponse } from 'next/server'
import { supaGet } from '@/lib/supabase'
import { getResidentialUser } from '@/lib/residential/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getResidentialUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const r = await supaGet(
    'residential_scan_jobs',
    `user_email=eq.${encodeURIComponent(user.email)}&select=id,status,query_type,query_value,query_state,source_filter,created_at,started_at,completed_at,result_count,error,progress&order=created_at.desc&limit=50`,
  )
  if (!r.ok) return NextResponse.json({ error: 'lookup_failed' }, { status: 502 })
  const rows = (await r.json()) as Array<Record<string, unknown>>

  const scans = rows.map((s) => ({
    id: s.id as string,
    userEmail: user.email,
    status: s.status as string,
    queryType: s.query_type as string,
    queryValue: s.query_value as string,
    queryState: s.query_state as string | null,
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
