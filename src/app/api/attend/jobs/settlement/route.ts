import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import {
  settleEndedEvents,
  releaseMaturedPayouts,
} from '@/lib/attend/payouts/settlement-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Vercel crons send `Authorization: Bearer $CRON_SECRET` (env var named
// exactly CRON_SECRET), matching the umbrella/spy cron routes.
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

// GET /api/attend/jobs/settlement — invoked on a schedule. Pass 1 settles
// newly-ended events; pass 2 releases matured held payouts. Bearer-secret
// gated; both passes are idempotent, so a missed item is retried next tick.
export async function GET(req: NextRequest) {
  if (!CRON_SECRET) {
    console.error('[settlement] CRON_SECRET not set')
    return NextResponse.json({ error: 'Cron not configured' }, { status: 500 })
  }
  if (!authorized(req.headers.get('authorization'), CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const settle = await settleEndedEvents()
    const release = await releaseMaturedPayouts()
    return NextResponse.json({ ok: true, settle, release })
  } catch (err) {
    console.error('[settlement] run failed:', (err as Error).message)
    return NextResponse.json({ error: 'Settlement run failed' }, { status: 500 })
  }
}
