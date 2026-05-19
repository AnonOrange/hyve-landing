import { NextRequest, NextResponse } from 'next/server'
import { requireReviewer } from '@/lib/attend/identity/roles'
import { decideRefund } from '@/lib/attend/refunds/refund-service'
import { NotFoundError, ValidationError } from '@/lib/attend/events/service'
import { writeAuditLog } from '@/lib/attend/audit/audit-log'

export const runtime = 'nodejs'

// POST /api/attend/admin/refunds/[id]/decision — approve or deny a refund
// request. Body: { decision: 'approve' | 'deny' }. ADMIN/REVIEWER only.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const reviewer = await requireReviewer()
  if (!reviewer) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  let body: { decision?: unknown }
  try {
    body = (await req.json()) as { decision?: unknown }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (body.decision !== 'approve' && body.decision !== 'deny') {
    return NextResponse.json({ error: 'decision must be approve or deny' }, { status: 400 })
  }

  try {
    await decideRefund(params.id, reviewer.id, body.decision)
    await writeAuditLog({
      actorId: reviewer.id,
      action: `refund.${body.decision}`,
      entityType: 'REFUND_REQUEST',
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
    console.error('[attend refund decision]:', (err as Error).message)
    return NextResponse.json(
      { error: 'That decision could not be recorded' },
      { status: 500 },
    )
  }
}
