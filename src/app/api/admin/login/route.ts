import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supaGet, supaPost, supaPatch } from '@/lib/supabase'
import { verifyAdminCredentials, type AdminRow } from '@/lib/admin/credentials'
import { createSession } from '@/lib/admin/session'
import { writeAuditLog } from '@/lib/admin/audit'
import { kv } from '@/lib/kv'

const LOCKOUT_LIMIT = 5
const LOCKOUT_TTL = 15 * 60  // 15 minutes in seconds

function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
}

async function fetchAdminByEmail(email: string): Promise<AdminRow | null> {
  const res = await supaGet('admins', `email=eq.${encodeURIComponent(email)}&active=eq.true&limit=1`)
  if (!res.ok) return null
  const rows = await res.json() as AdminRow[]
  return rows[0] ?? null
}

async function seedOwnerIfEmpty(email: string, passwordHash: string, pinHash: string): Promise<void> {
  const countRes = await supaGet('admins', 'select=id&limit=1')
  if (!countRes.ok) return
  const existing = await countRes.json() as unknown[]
  if (existing.length > 0) return

  await supaPost('admins', {
    email,
    password_hash: passwordHash,
    pin_hash: pinHash,
    role: 'owner',
    accepted_at: new Date().toISOString(),
  }, 'return=minimal')
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req)

  let body: { email?: string; password?: string; pin?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { email, password, pin } = body
  if (!email || !password || !pin) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  // Brute-force lockout check
  const lockKey = `login_fail:${ip}`
  const failures = (await kv.get<number>(lockKey)) ?? 0
  if (failures >= LOCKOUT_LIMIT) {
    return new NextResponse(JSON.stringify({ error: 'Too many attempts' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '900' },
    })
  }

  // Auto-seed on first run
  const seedEmail = process.env.ADMIN_SEED_EMAIL
  const seedPwdHash = process.env.ADMIN_SEED_PASSWORD_HASH
  const seedPinHash = process.env.ADMIN_SEED_PIN_HASH
  if (seedEmail && seedPwdHash && seedPinHash) {
    await seedOwnerIfEmpty(seedEmail, seedPwdHash, seedPinHash).catch(() => undefined)
  }

  const row = await fetchAdminByEmail(email.toLowerCase())
  const ok = await verifyAdminCredentials({ email, password, pin }, row)

  if (!ok) {
    const newCount = failures + 1
    await kv.set(lockKey, newCount, { ex: LOCKOUT_TTL })
    await writeAuditLog({ actor_email: email.toLowerCase(), action: 'login_fail', ip })
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  // Success — clear lockout, create session
  await Promise.all([
    kv.del(lockKey),
    supaPatch('admins', `id=eq.${row!.id}`, { last_login_at: new Date().toISOString() }, 'return=minimal'),
  ])

  const sessionId = await createSession({
    admin_id: row!.id,
    email: row!.email,
    role: row!.role,
    ip,
  })

  await writeAuditLog({ actor_email: row!.email, action: 'sign_in', ip })

  const res = NextResponse.json({ ok: true })
  res.cookies.set('__Host-admin_session', sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 24 * 60 * 60,
  })
  return res
}
