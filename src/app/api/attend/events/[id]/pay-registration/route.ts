import { NextRequest, NextResponse } from 'next/server'
import { requireCreator } from '@/lib/attend/identity/roles'
import {
  freeRegistrationsRemaining,
  grantFreeRegistration,
  startRegistrationCheckout,
} from '@/lib/attend/payments/registration-service'
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/attend/events/service'

export const runtime = 'nodejs'

// POST /api/attend/events/[id]/pay-registration
//
// Two paths:
//   - Free path: if the creator still has free-registration credits
//     (first 2 shows free), consume one and return { ok, free, remaining }.
//     The browser handles this as an in-place success and reloads.
//   - Paid path: otherwise, open the $50 Stripe Checkout session and return
//     { url } for the browser to redirect to.
//
// We re-check remaining inside the DB RPC under a row lock, so a stale
// remaining read here can't cause a double-grant — the worst case is we
// attempt the free path and the RPC throws NO_FREE_CREDITS, which we fall
// through to the paid path below.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const profile = await requireCreator()
  if (!profile) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  try {
    const remaining = await freeRegistrationsRemaining(profile.id)
    if (remaining > 0) {
      try {
        const result = await grantFreeRegistration(params.id, profile.id)
        return NextResponse.json(result)
      } catch (err) {
        // Race: the slot disappeared between count and RPC. Fall through to
        // the paid path so the creator isn't blocked.
        if (!(err instanceof ValidationError && err.message.includes('No free'))) throw err
      }
    }
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
