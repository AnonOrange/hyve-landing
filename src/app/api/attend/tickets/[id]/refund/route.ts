import { NextRequest, NextResponse } from 'next/server'
import { requireAttendUser } from '@/lib/attend/identity/roles'
import { requestRefund } from '@/lib/attend/refunds/refund-service'
import { ValidationError } from '@/lib/attend/events/service'

export const runtime = 'nodejs'

// POST /api/attend/tickets/[id]/refund — the buyer opens a refund request.
// Body: { reason?: string }.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAttendUser()
  if (!user) return NextResponse.json({ error: 'Please sign in' }, { status: 401 })

  let body: { reason?: unknown } = {}
  try {
    body = (await req.json()) as { reason?: unknown }
  } catch {
    // An empty body is fine — reason is optional.
  }
  const reason = typeof body.reason === 'string' ? body.reason.trim() || null : null

  try {
    await requestRefund(params.id, user.id, reason)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[attend refund request]:', (err as Error).message)
    return NextResponse.json(
      { error: 'Refund request could not be opened' },
      { status: 500 },
    )
  }
}
