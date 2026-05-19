import { NextRequest, NextResponse } from 'next/server'
import { recordImpressions } from '@/lib/attend/promotion/promotion-service'

export const runtime = 'nodejs'

// POST /api/attend/promotion/impressions — fire-and-forget beacon from the
// discovery Featured row. Body: { campaignIds: string[] }.
export async function POST(req: NextRequest) {
  let body: { campaignIds?: unknown }
  try {
    body = (await req.json()) as { campaignIds?: unknown }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const ids = Array.isArray(body.campaignIds)
    ? body.campaignIds.filter((x): x is string => typeof x === 'string').slice(0, 50)
    : []
  try {
    await recordImpressions(ids)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[promotion impressions]:', (err as Error).message)
    return NextResponse.json({ error: 'Tracking failed' }, { status: 500 })
  }
}
