import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { lookupInvite, markInviteUsed } from '@/lib/admin/invite'
import { writeAuditLog } from '@/lib/admin/audit'
import { supaPost } from '@/lib/supabase'

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

  const invite = await lookupInvite(token)
  if (!invite) {
    return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 400 })
  }

  const [passwordHash, pinHash] = await Promise.all([
    bcrypt.hash(password, 12),
    bcrypt.hash(pin, 12),
  ])

  const insertRes = await supaPost('admins', {
    email: invite.email,
    password_hash: passwordHash,
    pin_hash: pinHash,
    role: invite.role,
    invited_by: invite.invited_by,
    invited_at: invite.invited_at,
    accepted_at: new Date().toISOString(),
  }, 'return=minimal')

  if (!insertRes.ok) {
    const err = await insertRes.text()
    if (err.includes('duplicate') || err.includes('unique')) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }

  await Promise.all([
    markInviteUsed(token),
    writeAuditLog({ actor_email: invite.email, action: 'invite_accepted', target_email: invite.email }),
  ])

  return NextResponse.json({ ok: true })
}
