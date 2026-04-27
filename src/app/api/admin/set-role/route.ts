import { NextRequest, NextResponse } from 'next/server'
import { requireOwner, clientIp } from '@/lib/admin/api-auth'
import { assertNotLastOwner, LastOwnerError } from '@/lib/admin/last-owner-guard'
import { writeAuditLog } from '@/lib/admin/audit'
import { supaGet, supaPatch } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const session = await requireOwner(req)
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { admin_id?: string; role?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { admin_id, role } = body
  if (!admin_id || !role || !['owner', 'admin'].includes(role)) {
    return NextResponse.json({ error: 'admin_id and role (owner|admin) required' }, { status: 400 })
  }
  if (admin_id === session.admin_id) return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 })

  // If demoting an owner, guard against last-owner removal
  const targetRes = await supaGet('admins', `id=eq.${encodeURIComponent(admin_id)}&active=eq.true&select=id,email,role&limit=1`)
  if (!targetRes.ok) return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
  const targets = await targetRes.json() as { id: string; email: string; role: string }[]
  const target = targets[0]
  if (!target) return NextResponse.json({ error: 'Admin not found' }, { status: 404 })

  if (target.role === 'owner' && role === 'admin') {
    try {
      await assertNotLastOwner(admin_id)
    } catch (err) {
      if (err instanceof LastOwnerError) return NextResponse.json({ error: err.message }, { status: 400 })
      throw err
    }
  }

  await supaPatch('admins', `id=eq.${encodeURIComponent(admin_id)}`, { role })
  await writeAuditLog({ actor_email: session.email, action: 'role_change', target_email: target.email, detail: `${target.role}→${role}`, ip: clientIp(req) })

  return NextResponse.json({ ok: true })
}
