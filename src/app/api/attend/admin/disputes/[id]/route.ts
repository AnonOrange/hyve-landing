import { NextRequest, NextResponse } from 'next/server'
import { requireReviewer } from '@/lib/attend/identity/roles'
import { submitDisputeEvidence, acceptDispute } from '@/lib/attend/disputes/dispute-service'
import { NotFoundError, ValidationError } from '@/lib/attend/events/service'
import { writeAuditLog } from '@/lib/attend/audit/audit-log'

export const runtime = 'nodejs'

// POST /api/attend/admin/disputes/[id] — submit evidence to Stripe or concede a
// dispute. Body: { action: 'submit' | 'accept' }. ADMIN/REVIEWER only.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const reviewer = await requireReviewer()
  if (!reviewer) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  let body: { action?: unknown }
  try {
    body = (await req.json()) as { action?: unknown }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (body.action !== 'submit' && body.action !== 'accept') {
    return NextResponse.json({ error: 'action must be submit or accept' }, { status: 400 })
  }

  try {
    if (body.action === 'submit') {
      await submitDisputeEvidence(params.id)
    } else {
      await acceptDispute(params.id)
    }
    await writeAuditLog({
      actorId: reviewer.id,
      action: `dispute.${body.action}`,
      entityType: 'DISPUTE',
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
    console.error('[attend dispute action]:', (err as Error).message)
    return NextResponse.json({ error: 'That action could not be completed' }, { status: 500 })
  }
}
