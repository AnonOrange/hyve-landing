import { NextRequest } from 'next/server'
import { lookupSession, type AdminSession } from '@/lib/admin/session'

export function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
}

export async function requireAdminSession(req: NextRequest): Promise<AdminSession | null> {
  const sessionId = req.cookies.get('__Host-admin_session')?.value
  if (!sessionId) return null
  return lookupSession(sessionId).catch(() => null)
}

export async function requireOwner(req: NextRequest): Promise<AdminSession | null> {
  const session = await requireAdminSession(req)
  return session?.role === 'owner' ? session : null
}
