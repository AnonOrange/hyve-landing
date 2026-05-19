import { NextRequest, NextResponse } from 'next/server'
import { requireCreator } from '@/lib/attend/identity/roles'
import {
  createDraftEvent,
  listMyEvents,
  EventInput,
  ForbiddenError,
  ValidationError,
} from '@/lib/attend/events/service'

export const runtime = 'nodejs'

// GET /api/attend/events — the signed-in creator's events.
export async function GET() {
  const profile = await requireCreator()
  if (!profile) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  try {
    return NextResponse.json({ events: await listMyEvents(profile.id) })
  } catch (err) {
    console.error('[attend events] list:', (err as Error).message)
    return NextResponse.json({ error: 'Failed to load events' }, { status: 500 })
  }
}

// POST /api/attend/events — create a DRAFT event.
export async function POST(req: NextRequest) {
  const profile = await requireCreator()
  if (!profile) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: EventInput
  try {
    body = (await req.json()) as EventInput
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    const event = await createDraftEvent(profile.id, body)
    return NextResponse.json(event, { status: 201 })
  } catch (err) {
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 })
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 })
    console.error('[attend events] create:', (err as Error).message)
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 })
  }
}
