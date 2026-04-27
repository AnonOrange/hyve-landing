// Tiny auth helper for Hyve Residential API routes.
//
// Residential is a Pro-tier feature — the user must either:
//   1. Have a `hyve_spy_session` cookie starting with `comp:` (lifetime grant)
//   2. Have an `hyve_account` JWT cookie AND a Stripe sub on a Pro price ID
//
// For the scan API we just need the user's email to scope scan_jobs rows;
// the tier gate is already enforced client-side via hyve_spy_tier cookie
// + middleware. If a user without a session cookie hits these endpoints,
// we return 401.
//
// Returns the lowercased email or null.

import { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

export async function getResidentialUser(req: NextRequest): Promise<{ email: string } | null> {
  const session = req.cookies.get('hyve_spy_session')?.value
  if (session?.startsWith('comp:')) {
    const email = session.slice(5).trim().toLowerCase()
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { email }
    }
  }

  // Fall back to the hyve-spy-accounts JWT
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
      // Invalid JWT, fall through to null
    }
  }

  return null
}
