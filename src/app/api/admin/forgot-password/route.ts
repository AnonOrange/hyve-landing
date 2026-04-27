import { NextRequest, NextResponse } from 'next/server'
import { supaGet } from '@/lib/supabase'
import { createReset, sendResetEmail } from '@/lib/admin/reset'
import { writeAuditLog } from '@/lib/admin/audit'
import { incrementRateCount } from '@/lib/admin/ratelimit'
import type { AdminRow } from '@/lib/admin/credentials'

const RATE_LIMIT = 3
const RATE_TTL = 15 * 60

function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
}

const GENERIC_OK = NextResponse.json({ ok: true })

export async function POST(req: NextRequest) {
  const ip = clientIp(req)

  let body: { email?: string }
  try {
    body = await req.json()
  } catch {
    return GENERIC_OK
  }

  // Rate-limit by IP before doing any real work
  const rateKey = `forgot_pw_rate:${ip}`
  const count = await incrementRateCount(rateKey, RATE_TTL)
  if (count > RATE_LIMIT) return GENERIC_OK

  // Always respond immediately — real work fires deferred so timing is constant
  const email = body.email?.toLowerCase()
  if (email) {
    Promise.resolve().then(async () => {
      try {
        const res = await supaGet('admins', `email=eq.${encodeURIComponent(email)}&active=eq.true&limit=1`)
        if (!res.ok) return
        const rows = await res.json() as AdminRow[]
        const admin = rows[0]
        if (!admin) return

        const token = await createReset(admin.id)
        await Promise.all([
          sendResetEmail(email, token),
          writeAuditLog({ actor_email: email, action: 'reset_requested', target_email: email, ip }),
        ])
      } catch {
        // Deferred failures must not surface to caller
      }
    })
  }

  return GENERIC_OK
}
