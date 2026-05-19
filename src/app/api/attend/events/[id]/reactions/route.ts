import { NextRequest, NextResponse } from 'next/server'
import { requireAttendUser } from '@/lib/attend/identity/roles'
import { postReaction } from '@/lib/attend/live/reaction-service'
import { ValidationError } from '@/lib/attend/events/service'

export const runtime = 'nodejs'

// POST /api/attend/events/[id]/reactions — send a reaction. Body: { kind }.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAttendUser()
  if (!user) return NextResponse.json({ error: 'Please sign in' }, { status: 401 })

  let body: { kind?: unknown }
  try {
    body = (await req.json()) as { kind?: unknown }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (typeof body.kind !== 'string') {
    return NextResponse.json({ error: 'A reaction kind is required' }, { status: 400 })
  }

  try {
    await postReaction(params.id, user.id, body.kind)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[attend reactions]:', (err as Error).message)
    return NextResponse.json({ error: 'Failed to send reaction' }, { status: 500 })
  }
}
