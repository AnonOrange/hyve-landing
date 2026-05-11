// /api/admin/caseline/comp-keys — admin-only issuance, listing, and
// revocation of free CaseLine license keys.
//
//   GET    → { keys: CompKeyRow[] }
//   POST   { tier: '5'|'10'|'custom', max_seats?: number, label?: string }
//            → { ok: true, key: 'HYVE-XXXX-XXXX-XXXX', row: CompKeyRow }
//   DELETE ?key=HYVE-...&reason=...  → { ok: true }
//
// Per Q2-a: zero required fields. Admin types tier, mints key, done.
// Optional `label` is encouraged but not enforced. All operations write
// to admin_audit_log so we always know WHO issued/revoked WHAT and WHEN.

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession, clientIp } from '@/lib/admin/api-auth'
import { writeAuditLog } from '@/lib/admin/audit'
import {
  issueCompKey,
  listCompKeys,
  revokeCompKey,
  type CompKeyRow,
} from '@/lib/admin/comp-keys'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await requireAdminSession(req)
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const onlyActive = req.nextUrl.searchParams.get('active') === '1'
  const keys = await listCompKeys({ onlyActive })
  return NextResponse.json({ keys })
}

export async function POST(req: NextRequest) {
  const session = await requireAdminSession(req)
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as {
    tier?: string
    max_seats?: number
    label?: string
  }
  const tier = body.tier
  if (tier !== '5' && tier !== '10' && tier !== 'custom') {
    return NextResponse.json({ error: 'tier must be one of: 5, 10, custom' }, { status: 400 })
  }
  const result = await issueCompKey({
    tier,
    max_seats: body.max_seats,
    label: body.label?.toString().trim() || null,
    issued_by: session.email,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  await writeAuditLog({
    actor_email: session.email,
    action: 'caseline_comp_key_issue',
    target_email: result.row.label || result.key,
    detail: JSON.stringify({ key: result.key, tier: result.row.tier, max_seats: result.row.max_seats, label: result.row.label }),
    ip: clientIp(req),
  })
  return NextResponse.json({ ok: true, key: result.key, row: result.row })
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdminSession(req)
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const key = (req.nextUrl.searchParams.get('key') || '').trim().toUpperCase()
  const reason = (req.nextUrl.searchParams.get('reason') || '').trim() || null
  if (!/^HYVE-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key)) {
    return NextResponse.json({ error: 'malformed key' }, { status: 400 })
  }
  const ok = await revokeCompKey(key, session.email, reason)
  if (!ok) return NextResponse.json({ error: 'not_found_or_revoke_failed' }, { status: 404 })
  await writeAuditLog({
    actor_email: session.email,
    action: 'caseline_comp_key_revoke',
    target_email: key,
    detail: reason,
    ip: clientIp(req),
  })
  return NextResponse.json({ ok: true })
}

export type { CompKeyRow }
