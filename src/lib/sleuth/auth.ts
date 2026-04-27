// Tiny auth helper for Hyve Sleuth scan API routes — same pattern as
// src/lib/residential/auth.ts. Reuses the comp: + JWT cookie flow.

import { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

export async function getSleuthUser(req: NextRequest): Promise<{ email: string } | null> {
  const session = req.cookies.get('hyve_spy_session')?.value
  if (session?.startsWith('comp:')) {
    const email = session.slice(5).trim().toLowerCase()
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { email }
    }
  }

  const jwt = req.cookies.get('hyve_account')?.value
  if (jwt) {
    try {
      const secret = process.env.JWT_SECRET
      if (!secret) return null
      const { payload } = await jwtVerify(jwt, new TextEncoder().encode(secret), {
        issuer: 'hyve-spy-accounts',
      })
      if (typeof payload.email === 'string') {
        return { email: payload.email.toLowerCase() }
      }
    } catch {
      // fall through
    }
  }

  return null
}
