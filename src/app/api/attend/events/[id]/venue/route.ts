import { NextRequest, NextResponse } from 'next/server'
import { requireCreator } from '@/lib/attend/identity/roles'
import { linkEventVenue, ForbiddenError, NotFoundError, ValidationError } from '@/lib/attend/events/service'

export const runtime = 'nodejs'

// PUT /api/attend/events/[id]/venue — link (or clear, with null) the event's
// venue. Body: { venueId: string | null }. Creator-owned only.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const profile = await requireCreator()
  if (!profile) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  try {
    const body = (await req.json().catch(() => ({}))) as { venueId?: unknown }
    const venueId =
      typeof body.venueId === 'string' && body.venueId.length > 0 ? body.venueId : null
    await linkEventVenue(params.id, venueId, profile.id)
    return NextResponse.json({ ok: true, venueId })
  } catch (err) {
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 })
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 })
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 })
    console.error('[attend event venue]:', (err as Error).message)
    return NextResponse.json({ error: 'Failed to set venue' }, { status: 500 })
  }
}
