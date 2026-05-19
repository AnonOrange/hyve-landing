import { NextRequest, NextResponse } from 'next/server'
import { requireCreator } from '@/lib/attend/identity/roles'
import {
  editTicketType,
  removeTicketType,
  TicketTypeInput,
} from '@/lib/attend/ticketing/ticket-type-service'
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/attend/events/service'

export const runtime = 'nodejs'

function mapError(err: unknown): NextResponse {
  if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 })
  if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 })
  if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 })
  console.error('[attend ticket-types]:', (err as Error).message)
  return NextResponse.json({ error: 'Request failed' }, { status: 500 })
}

// PATCH /api/attend/ticket-types/[id]
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const profile = await requireCreator()
  if (!profile) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  let body: TicketTypeInput
  try {
    body = (await req.json()) as TicketTypeInput
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  try {
    await editTicketType(params.id, profile.id, body)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return mapError(err)
  }
}

// DELETE /api/attend/ticket-types/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const profile = await requireCreator()
  if (!profile) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  try {
    await removeTicketType(params.id, profile.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return mapError(err)
  }
}
