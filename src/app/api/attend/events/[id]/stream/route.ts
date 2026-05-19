import { NextRequest, NextResponse } from 'next/server'
import { requireCreator } from '@/lib/attend/identity/roles'
import { createEventStream } from '@/lib/attend/streaming/streaming-service'
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/attend/events/service'

export const runtime = 'nodejs'

// POST /api/attend/events/[id]/stream — provision the event's Mux Live stream.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const profile = await requireCreator()
  if (!profile) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  try {
    const stream = await createEventStream(params.id, profile.id)
    return NextResponse.json({
      ok: true,
      rtmpUrl: stream.rtmp_url,
      streamKey: stream.stream_key,
    })
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 })
    }
    console.error('[attend stream]:', (err as Error).message)
    return NextResponse.json({ error: 'Stream setup failed' }, { status: 500 })
  }
}
