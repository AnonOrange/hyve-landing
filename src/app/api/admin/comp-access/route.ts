import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession, clientIp } from '@/lib/admin/api-auth'
import {
  listCompEmails,
  grantCompAccess,
  revokeCompAccess,
} from '@/lib/admin/comp-access'
import { writeAuditLog } from '@/lib/admin/audit'

// /api/admin/comp-access — grant / revoke / list emails on the comp-access
// allowlist. Any signed-in admin (owner or admin role) can use this.
//
//   GET    → { comp_emails: CompEmailRow[] }
//   POST   { email, notes? } → { ok: true }
//   DELETE ?email=foo@bar.com → { ok: true }
//
// All mutations append to admin_audit_log. The hardcoded owner email
// (vibesoftwaresolutions@gmail.com) cannot be revoked from this endpoint
// — that's enforced inside revokeCompAccess(), which returns false for
// hardcoded entries. The UI hides the revoke button on those rows too.

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await requireAdminSession(req)
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const list = await listCompEmails()
  return NextResponse.json({ comp_emails: list })
}

export async function POST(req: NextRequest) {
  const session = await requireAdminSession(req)
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const email = String(body.email || '').trim().toLowerCase()
  const notes = body.notes ? String(body.notes).slice(0, 500) : null
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
  }
  const ok = await grantCompAccess(email, session.email, notes)
  if (!ok) {
    return NextResponse.json({ error: 'grant_failed' }, { status: 502 })
  }
  await writeAuditLog({
    actor_email: session.email,
    action: 'comp_grant',
    target_email: email,
    detail: notes,
    ip: clientIp(req),
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdminSession(req)
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const email = (req.nextUrl.searchParams.get('email') || '').trim().toLowerCase()
  if (!email) return NextResponse.json({ error: 'email_required' }, { status: 400 })
  const ok = await revokeCompAccess(email)
  if (!ok) {
    return NextResponse.json(
      { error: 'revoke_blocked', detail: 'Hardcoded owner emails cannot be revoked.' },
      { status: 403 },
    )
  }
  await writeAuditLog({
    actor_email: session.email,
    action: 'comp_revoke',
    target_email: email,
    ip: clientIp(req),
  })
  return NextResponse.json({ ok: true })
}
