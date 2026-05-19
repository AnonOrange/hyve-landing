import { NextRequest, NextResponse } from 'next/server'
import { requireCreator } from '@/lib/attend/identity/roles'
import { savePromotionCreative } from '@/lib/attend/promotion/promotion-service'
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/attend/events/service'

export const runtime = 'nodejs'

// POST /api/attend/creator/events/[id]/promotion — save the ad creative.
// Body: { headline: string, body: string, approved: boolean }.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const profile = await requireCreator()
  if (!profile) return NextResponse.json({ error: 'Please sign in' }, { status: 401 })

  let body: { headline?: unknown; body?: unknown; approved?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    await savePromotionCreative(params.id, profile.id, {
      headline: typeof body.headline === 'string' ? body.headline : '',
      body: typeof body.body === 'string' ? body.body : '',
      approved: body.approved === true,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 })
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    console.error('[attend promotion save]:', (err as Error).message)
    return NextResponse.json({ error: 'Could not save the creative' }, { status: 500 })
  }
}
