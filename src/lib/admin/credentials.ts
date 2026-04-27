// src/lib/admin/credentials.ts
//
// Verifies submitted credentials against a Supabase admin row.
// Always runs both bcrypt comparisons even when the row is null so
// "no such email" and "wrong password" have identical timing.

import bcrypt from 'bcryptjs'

export interface AdminRow {
  id: string
  email: string
  password_hash: string
  pin_hash: string
  role: 'owner' | 'admin'
  active: boolean
}

// Module-level sentinel hash — generated once at startup, held in memory.
// Used in place of the real hash when no admin row is found.
let _sentinelPwd: string | null = null
let _sentinelPin: string | null = null

function sentinelHashes(): [string, string] {
  if (!_sentinelPwd) {
    const rnd = () => Math.random().toString(36) + Math.random().toString(36)
    _sentinelPwd = bcrypt.hashSync(rnd(), 12)
    _sentinelPin = bcrypt.hashSync(rnd(), 12)
  }
  return [_sentinelPwd!, _sentinelPin!]
}

export async function verifyAdminCredentials(
  submitted: { email: string; password: string; pin: string },
  row: AdminRow | null,
): Promise<boolean> {
  if (!submitted.password || !submitted.pin) return false

  const [fallbackPwd, fallbackPin] = sentinelHashes()
  const pwdHash = row?.password_hash ?? fallbackPwd
  const pinHash = row?.pin_hash ?? fallbackPin

  const [pwdOk, pinOk] = await Promise.all([
    bcrypt.compare(submitted.password, pwdHash),
    bcrypt.compare(submitted.pin, pinHash),
  ])

  return row !== null && pwdOk && pinOk
}
