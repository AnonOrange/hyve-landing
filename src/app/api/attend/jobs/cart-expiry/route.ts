import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { expireStaleCarts } from '@/lib/attend/payments/cart-expiry-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Vercel crons send `Authorization: Bearer $CRON_SECRET` (the env var must be
// named exactly CRON_SECRET), matching the umbrella/spy cron routes.
const CRON_SECRET = process.env.CRON_SECRET

// Constant-time bearer check — avoids leaking the secret via response timing.
function authorized(header: string | null, secret: string): boolean {
  const expected = `Bearer ${secret}`
  const provided = header ?? ''
  return (
    provided.length === expected.length &&
    timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  )
}

// GET /api/attend/jobs/cart-expiry — invoked on a schedule (Vercel cron, see
// vercel.json). Bearer-secret gated; idempotent (attend_expire_order no-ops a
// non-PENDING order).
export async function GET(req: NextRequest) {
  if (!CRON_SECRET) {
    console.error('[cart-expiry] CRON_SECRET not set')
    return NextResponse.json({ error: 'Cron not configured' }, { status: 500 })
  }
  if (!authorized(req.headers.get('authorization'), CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const summary = await expireStaleCarts()
    return NextResponse.json({ ok: true, ...summary })
  } catch (err) {
    console.error('[cart-expiry] run failed:', (err as Error).message)
    return NextResponse.json({ error: 'Cart expiry failed' }, { status: 500 })
  }
}
