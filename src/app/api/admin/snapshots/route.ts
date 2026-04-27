import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/admin/api-auth'
import { supaGet } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const session = await requireAdminSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const res = await supaGet('snapshots', 'select=key,payload,ts')
  if (!res.ok) return NextResponse.json({}, { status: 200 })

  const rows = await res.json() as { key: string; payload: unknown; ts: string }[]
  const snapshots = Object.fromEntries(rows.map(r => [r.key, { payload: r.payload, ts: r.ts }]))
  return NextResponse.json(snapshots)
}
