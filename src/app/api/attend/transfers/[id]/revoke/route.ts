import { NextRequest, NextResponse } from 'next/server'
import { requireAttendUser } from '@/lib/attend/identity/roles'
import { revokeTransfer } from '@/lib/attend/transfers/transfer-service'
import { ValidationError } from '@/lib/attend/events/service'

export const runtime = 'nodejs'

// POST /api/attend/transfers/[id]/revoke — the sender cancels a pending transfer.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAttendUser()
  if (!user) return NextResponse.json({ error: 'Please sign in' }, { status: 401 })

  try {
    await revokeTransfer(params.id, user.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[attend transfer revoke]:', (err as Error).message)
    return NextResponse.json({ error: 'Revoke failed' }, { status: 500 })
  }
}
