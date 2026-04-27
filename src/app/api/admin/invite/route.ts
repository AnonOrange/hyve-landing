import { NextRequest, NextResponse } from 'next/server'
import { requireOwner, clientIp } from '@/lib/admin/api-auth'
import { createInvite, sendInviteEmail } from '@/lib/admin/invite'
import { writeAuditLog } from '@/lib/admin/audit'

export async function POST(req: NextRequest) {
  const session = await requireOwner(req)
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { email?: string; role?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const email = body.email?.toLowerCase().trim()
  const role = body.role as 'owner' | 'admin' | undefined

  if (!email || !role || !['owner', 'admin'].includes(role)) {
    return NextResponse.json({ error: 'email and role (owner|admin) required' }, { status: 400 })
  }

  try {
    const invite = await createInvite({ email, role, invited_by: session.admin_id })
    await sendInviteEmail(invite.email, invite.token).catch(() => undefined)
    await writeAuditLog({ actor_email: session.email, action: 'invite', target_email: email, detail: `role=${role}`, ip: clientIp(req) })
    return NextResponse.json({ ok: true, expires_at: invite.expires_at })
  } catch (err) {
    console.error('[invite]', err)
    return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 })
  }
}
