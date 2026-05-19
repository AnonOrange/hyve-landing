import { NextRequest, NextResponse } from 'next/server'
import { requireReviewer } from '@/lib/attend/identity/roles'
import {
  reviewApprove,
  reviewReject,
  NotFoundError,
  ValidationError,
} from '@/lib/attend/events/service'
import { writeAuditLog } from '@/lib/attend/audit/audit-log'

export const runtime = 'nodejs'

// POST /api/attend/admin/events/[id]/review — approve or reject a submitted
// event. Body: { decision: 'approve' | 'reject' }. ADMIN/REVIEWER only.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const reviewer = await requireReviewer()
  if (!reviewer) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  let body: { decision?: unknown }
  try {
    body = (await req.json()) as { decision?: unknown }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (body.decision !== 'approve' && body.decision !== 'reject') {
    return NextResponse.json(
      { error: 'decision must be approve or reject' },
      { status: 400 },
    )
  }

  try {
    if (body.decision === 'approve') {
      await reviewApprove(params.id, reviewer.id)
    } else {
      await reviewReject(params.id, reviewer.id)
    }
    await writeAuditLog({
      actorId: reviewer.id,
      action: `event.${body.decision}`,
      entityType: 'EVENT',
      entityId: params.id,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 })
    }
    console.error('[attend review]:', (err as Error).message)
    return NextResponse.json({ error: 'Review failed' }, { status: 500 })
  }
}
