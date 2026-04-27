import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession, clientIp } from '@/lib/admin/api-auth'
import { writeAuditLog } from '@/lib/admin/audit'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const session = await requireAdminSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'Scan not configured' }, { status: 500 })

  const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'
  const res = await fetch(`${base}/api/cron/snapshot`, {
    headers: { Authorization: `Bearer ${cronSecret}` },
    signal: AbortSignal.timeout(55_000),
  })

  if (!res.ok) return NextResponse.json({ error: 'Scan failed' }, { status: 502 })

  await writeAuditLog({ actor_email: session.email, action: 'scan', ip: clientIp(req) })
  return NextResponse.json(await res.json())
}
