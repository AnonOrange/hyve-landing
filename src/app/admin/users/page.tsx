import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin/get-session'
import { supaGet } from '@/lib/supabase'
import AdminShell from '../_shell'
import UsersClient from './_client'
import CompAccessClient from './_comp-access-client'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Users · HYVE Admin' }

export default async function UsersPage() {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')

  const now = new Date().toISOString()
  const [snapsRes, adminsRes, invitesRes, auditRes] = await Promise.all([
    supaGet('snapshots', 'key=in.(threat_level,last_cron)&select=key,payload'),
    supaGet('admins', 'active=eq.true&select=id,email,role,accepted_at,last_login_at&order=accepted_at.asc'),
    supaGet('admin_invites', `used_at=is.null&expires_at=gt.${encodeURIComponent(now)}&select=token,email,role,invited_at,expires_at&order=invited_at.desc`),
    supaGet('admin_audit_log', 'select=id,ts,actor_email,action,target_email,detail,ip&order=ts.desc&limit=50'),
  ])

  const snaps = snapsRes.ok
    ? Object.fromEntries((await snapsRes.json() as { key: string; payload: unknown }[]).map(r => [r.key, r.payload]))
    : {}

  const threat   = snaps.threat_level as { level: 'low'|'guarded'|'elevated'|'high'|'critical'; score: number; signals: Array<{ kind: string; severity: number }> } | null
  const lastCron = snaps.last_cron as { ts: number } | null

  const admins   = adminsRes.ok   ? await adminsRes.json()   : []
  const invites  = invitesRes.ok  ? await invitesRes.json()  : []
  const auditLog = auditRes.ok    ? await auditRes.json()    : []

  return (
    <AdminShell session={session} threat={threat} lastScanTs={lastCron?.ts ?? null} activePath="/admin/users">
      <UsersClient
        admins={admins}
        invites={invites}
        auditLog={auditLog}
        currentAdminId={session.admin_id}
        currentRole={session.role}
      />
      {/*
        Comp Access section — admin grants free lifetime Pro access by email.
        Renders below the main admin user table so the existing layout stays
        intact. Pulls its own data on mount via /api/admin/comp-access.
      */}
      <CompAccessClient />
    </AdminShell>
  )
}
