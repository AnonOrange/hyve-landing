import { NextRequest, NextResponse } from 'next/server'
import { lookupSession, deleteSession } from '@/lib/admin/session'
import { writeAuditLog } from '@/lib/admin/audit'

function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
}

export async function POST(req: NextRequest) {
  const sessionId = req.cookies.get('__Host-admin_session')?.value
  if (sessionId) {
    const session = await lookupSession(sessionId)
    if (session) {
      await Promise.all([
        deleteSession(sessionId),
        writeAuditLog({ actor_email: session.email, action: 'sign_out', ip: clientIp(req) }),
      ])
    } else {
      await deleteSession(sessionId)
    }
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.delete('__Host-admin_session')
  return res
}
