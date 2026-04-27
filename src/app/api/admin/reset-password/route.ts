import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { lookupReset, markResetUsed } from '@/lib/admin/reset'
import { deleteAllSessionsForEmail } from '@/lib/admin/session'
import { writeAuditLog } from '@/lib/admin/audit'
import { supaGet, supaPatch } from '@/lib/supabase'
import type { AdminRow } from '@/lib/admin/credentials'

export async function POST(req: NextRequest) {
  let body: { token?: string; password?: string; pin?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { token, password, pin } = body
  if (!token || !password || !pin) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  if (password.length < 12) {
    return NextResponse.json({ error: 'Password must be at least 12 characters' }, { status: 400 })
  }
  if (!/^\d{6}$/.test(pin)) {
    return NextResponse.json({ error: 'PIN must be exactly 6 digits' }, { status: 400 })
  }

  const resetRow = await lookupReset(token)
  if (!resetRow) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 })
  }

  const adminRes = await supaGet('admins', `id=eq.${resetRow.admin_id}&limit=1`)
  if (!adminRes.ok) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
  const admins = await adminRes.json() as AdminRow[]
  const admin = admins[0]
  if (!admin) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 })
  }

  const [passwordHash, pinHash] = await Promise.all([
    bcrypt.hash(password, 12),
    bcrypt.hash(pin, 12),
  ])

  await Promise.all([
    supaPatch('admins', `id=eq.${admin.id}`, { password_hash: passwordHash, pin_hash: pinHash }),
    markResetUsed(token),
  ])

  await Promise.all([
    deleteAllSessionsForEmail(admin.email),
    writeAuditLog({ actor_email: admin.email, action: 'password_reset' }),
  ])

  return NextResponse.json({ ok: true })
}
