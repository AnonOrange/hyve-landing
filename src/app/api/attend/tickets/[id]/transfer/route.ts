import { NextRequest, NextResponse } from 'next/server'
import { requireAttendUser } from '@/lib/attend/identity/roles'
import { initiateTransfer } from '@/lib/attend/transfers/transfer-service'
import { ValidationError } from '@/lib/attend/events/service'

export const runtime = 'nodejs'

// POST /api/attend/tickets/[id]/transfer — open a transfer of this ticket.
// Body: { method: 'EMAIL' | 'FRIEND_CODE', toEmail?: string }.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAttendUser()
  if (!user) return NextResponse.json({ error: 'Please sign in' }, { status: 401 })

  let body: { method?: unknown; toEmail?: unknown }
  try {
    body = (await req.json()) as { method?: unknown; toEmail?: unknown }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (body.method !== 'EMAIL' && body.method !== 'FRIEND_CODE') {
    return NextResponse.json({ error: 'A transfer method is required' }, { status: 400 })
  }
  const toEmail = typeof body.toEmail === 'string' ? body.toEmail : null

  try {
    const result = await initiateTransfer(
      params.id,
      user.id,
      body.method,
      toEmail,
      req.nextUrl.origin,
    )
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[attend transfer]:', (err as Error).message)
    return NextResponse.json({ error: 'Transfer could not be started' }, { status: 500 })
  }
}
