import { NextRequest, NextResponse } from 'next/server'
import { requireAttendUser } from '@/lib/attend/identity/roles'
import { claimTransfer } from '@/lib/attend/transfers/transfer-service'
import { ValidationError } from '@/lib/attend/events/service'

export const runtime = 'nodejs'

// POST /api/attend/transfers/claim — the recipient claims a transfer.
// Body: { token?: string, friendCode?: string }.
export async function POST(req: NextRequest) {
  const user = await requireAttendUser()
  if (!user) return NextResponse.json({ error: 'Please sign in to claim' }, { status: 401 })

  let body: { token?: unknown; friendCode?: unknown }
  try {
    body = (await req.json()) as { token?: unknown; friendCode?: unknown }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const token = typeof body.token === 'string' ? body.token : undefined
  const code = typeof body.friendCode === 'string' ? body.friendCode : undefined
  if (!token && !code) {
    return NextResponse.json(
      { error: 'A claim link or friend code is required' },
      { status: 400 },
    )
  }

  try {
    await claimTransfer({ claimToken: token, friendCode: code }, user.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[attend transfer claim]:', (err as Error).message)
    return NextResponse.json({ error: 'Claim failed' }, { status: 500 })
  }
}
