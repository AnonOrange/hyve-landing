import { jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const ACCOUNT_COOKIE = 'hyve_account'

export type SpyUser = { sub: string; email: string }

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET missing')
  return new TextEncoder().encode(s)
}

// Verify the hyve_account JWT cookie set by hyve-spy-accounts on .hyveapp.co.
// Returns the user (sub + email) or null if missing/invalid.
export async function getSpyUser(): Promise<SpyUser | null> {
  const token = cookies().get(ACCOUNT_COOKIE)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: 'hyve-spy-accounts' })
    if (!payload.sub || typeof payload.email !== 'string') return null
    return { sub: payload.sub, email: payload.email }
  } catch {
    return null
  }
}

// Email-allowlisted comp users — for /spy/admin and similar internal tools.
export function isCompEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const COMP = new Set(['vibesoftwaresolutions@gmail.com', 'luckybstudios@gmail.com'])
  return COMP.has(email.trim().toLowerCase())
}
