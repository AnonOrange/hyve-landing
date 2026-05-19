import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requireAttendUser } from '@/lib/attend/identity/roles'
import { listRoomTicketsForOwner } from '@/lib/attend/streaming/attendance-repository'
import { checkInToRoom } from '@/lib/attend/streaming/room-service'
import { ValidationError } from '@/lib/attend/events/service'

export const runtime = 'nodejs'

// POST /api/attend/events/[id]/check-in — enter the event's live room.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAttendUser()
  if (!user) return NextResponse.json({ error: 'Please sign in' }, { status: 401 })

  const tickets = await listRoomTicketsForOwner(params.id, user.id)
  if (tickets.length === 0) {
    return NextResponse.json({ error: 'You do not have a ticket for this event' }, { status: 403 })
  }

  const fwd = req.headers.get('x-forwarded-for')
  const ipHash = fwd ? createHash('sha256').update(fwd).digest('hex') : null
  const browser = req.headers.get('user-agent')

  try {
    await checkInToRoom(tickets[0].id, user.id, { ipHash, browser })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[attend check-in]:', (err as Error).message)
    return NextResponse.json({ error: 'Check-in failed' }, { status: 500 })
  }
}
