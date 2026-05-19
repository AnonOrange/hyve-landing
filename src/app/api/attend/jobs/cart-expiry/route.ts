import { NextRequest, NextResponse } from 'next/server'
import { expireStaleCarts } from '@/lib/attend/payments/cart-expiry-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CRON_SECRET = process.env.ATTEND_CRON_SECRET

// GET /api/attend/jobs/cart-expiry — invoked on a schedule (GitHub Actions).
// Bearer-secret gated; idempotent (attend_expire_order no-ops a non-PENDING order).
export async function GET(req: NextRequest) {
  if (!CRON_SECRET) {
    console.error('[cart-expiry] ATTEND_CRON_SECRET not set')
    return NextResponse.json({ error: 'Cron not configured' }, { status: 500 })
  }
  if (req.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
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
