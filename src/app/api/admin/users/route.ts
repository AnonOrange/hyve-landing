import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/admin/api-auth'
import { supaGet } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const session = await requireAdminSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date().toISOString()
  const [adminsRes, invitesRes, auditRes] = await Promise.all([
    supaGet('admins', 'active=eq.true&select=id,email,role,accepted_at,last_login_at&order=accepted_at.asc'),
    supaGet('admin_invites', `used_at=is.null&expires_at=gt.${encodeURIComponent(now)}&select=token,email,role,invited_at,expires_at&order=invited_at.desc`),
    supaGet('admin_audit_log', 'select=id,ts,actor_email,action,target_email,detail,ip&order=ts.desc&limit=50'),
  ])

  return NextResponse.json({
    admins:   adminsRes.ok   ? await adminsRes.json()  : [],
    invites:  invitesRes.ok  ? await invitesRes.json() : [],
    auditLog: auditRes.ok    ? await auditRes.json()   : [],
  })
}
