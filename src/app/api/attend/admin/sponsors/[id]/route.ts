import { NextRequest, NextResponse } from 'next/server'
import { requireReviewer } from '@/lib/attend/identity/roles'
import { setSponsorActive, deleteSponsor } from '@/lib/attend/sponsors/sponsor-service'
import { writeAuditLog } from '@/lib/attend/audit/audit-log'

export const runtime = 'nodejs'

// PATCH /api/attend/admin/sponsors/[id] — toggle on/off. Body { isActive }.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const reviewer = await requireReviewer()
  if (!reviewer) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  const body = (await req.json().catch(() => ({}))) as { isActive?: unknown }
  if (typeof body.isActive !== 'boolean') {
    return NextResponse.json({ error: 'isActive must be a boolean' }, { status: 400 })
  }
  try {
    await setSponsorActive(params.id, body.isActive, reviewer.id)
    await writeAuditLog({
      actorId: reviewer.id,
      action: body.isActive ? 'sponsor.activate' : 'sponsor.deactivate',
      entityType: 'SPONSOR',
      entityId: params.id,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[attend sponsor toggle]:', (err as Error).message)
    return NextResponse.json({ error: 'Failed to update sponsor' }, { status: 500 })
  }
}

// DELETE /api/attend/admin/sponsors/[id] — soft delete.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const reviewer = await requireReviewer()
  if (!reviewer) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  try {
    await deleteSponsor(params.id, reviewer.id)
    await writeAuditLog({
      actorId: reviewer.id,
      action: 'sponsor.delete',
      entityType: 'SPONSOR',
      entityId: params.id,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[attend sponsor delete]:', (err as Error).message)
    return NextResponse.json({ error: 'Failed to delete sponsor' }, { status: 500 })
  }
}
