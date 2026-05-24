import { NextRequest, NextResponse } from 'next/server'
import { requireCreator } from '@/lib/attend/identity/roles'
import { createCreatorVenue } from '@/lib/attend/venues/venue-service'
import { ValidationError } from '@/lib/attend/events/service'

export const runtime = 'nodejs'

// POST /api/attend/venues — create a venue managed by the calling creator.
export async function POST(req: NextRequest) {
  const profile = await requireCreator()
  if (!profile) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  try {
    const body = (await req.json().catch(() => ({}))) as {
      name?: string
      city?: string
      country?: string
    }
    const venue = await createCreatorVenue({
      name: body.name ?? '',
      city: body.city,
      country: body.country,
      actor: profile.id,
    })
    return NextResponse.json({ id: venue.id, slug: venue.slug })
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[attend create venue]:', (err as Error).message)
    return NextResponse.json({ error: 'Failed to create venue' }, { status: 500 })
  }
}
