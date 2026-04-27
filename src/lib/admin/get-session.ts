import { cookies } from 'next/headers'
import { lookupSession, refreshSession, type AdminSession } from '@/lib/admin/session'

export async function getAdminSession(): Promise<AdminSession | null> {
  const id = cookies().get('__Host-admin_session')?.value
  if (!id) return null
  const session = await lookupSession(id).catch(() => null)
  if (session) refreshSession(id).catch(() => undefined)
  return session
}
