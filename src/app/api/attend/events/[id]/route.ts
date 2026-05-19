import { NextRequest, NextResponse } from 'next/server'
import { requireCreator } from '@/lib/attend/identity/roles'
import {
  getCreatorEvent,
  updateEventDetails,
  changeEventStatus,
  advanceSetup,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/lib/attend/events/service'
import { payoutsEnabled } from '@/lib/attend/payments/connect-service'

export const runtime = 'nodejs'

function mapError(err: unknown, context: string): NextResponse {
  if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 })
  if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 })
  if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 })
  console.error(`[attend events] ${context}:`, (err as Error).message)
  return NextResponse.json({ error: 'Request failed' }, { status: 500 })
}

// GET /api/attend/events/[id] — one of the creator's events.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const profile = await requireCreator()
  if (!profile) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  try {
    return NextResponse.json(await getCreatorEvent(params.id, profile.id))
  } catch (err) {
    return mapError(err, 'get')
  }
}

// PATCH /api/attend/events/[id] — a `status` field triggers a lifecycle
// transition; any other fields are a draft-details edit.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const profile = await requireCreator()
  if (!profile) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    if (body.action === 'advance-setup') {
      const status = await advanceSetup(params.id, profile.id, await payoutsEnabled(profile.id))
      return NextResponse.json({ ok: true, status })
    }
    if (body.action === 'cancel') {
      await changeEventStatus(params.id, profile.id, 'CANCELLED')
      return NextResponse.json({ ok: true, status: 'CANCELLED' })
    }
    if (body.action !== undefined) {
      return NextResponse.json({ error: `Unknown action: ${String(body.action)}` }, { status: 400 })
    }
    await updateEventDetails(params.id, profile.id, body)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return mapError(err, 'patch')
  }
}
