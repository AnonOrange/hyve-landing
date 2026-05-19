import { NextRequest, NextResponse } from 'next/server'
import { requireCreator } from '@/lib/attend/identity/roles'
import { startRegistrationCheckout } from '@/lib/attend/payments/registration-service'
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/attend/events/service'

export const runtime = 'nodejs'

// POST /api/attend/events/[id]/pay-registration — open the $50 Stripe Checkout.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const profile = await requireCreator()
  if (!profile) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  try {
    const result = await startRegistrationCheckout(params.id, profile.id, req.nextUrl.origin)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 })
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 })
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 })
    console.error('[attend pay-registration]:', (err as Error).message)
    return NextResponse.json({ error: 'Failed to start checkout' }, { status: 500 })
  }
}
