import { NextRequest, NextResponse } from 'next/server'
import { ATTEND_BETA_MODE } from '@/lib/attend/config'
import { requireCreator } from '@/lib/attend/identity/roles'
import {
  freeRegistrationsRemaining,
  grantBetaRegistration,
  grantFreeRegistration,
  startRegistrationCheckout,
} from '@/lib/attend/payments/registration-service'
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/attend/events/service'

export const runtime = 'nodejs'

// POST /api/attend/events/[id]/pay-registration
//
// Three paths, picked in priority order:
//   1. Beta path: while ATTEND_BETA_MODE is true, every show registers for
//      free with no credit consumed — keeps welcome-offer credits intact
//      for post-launch. Returns { ok, beta }.
//   2. Free path: outside beta, if the creator still has welcome-offer
//      credits (first 2 shows free), consume one. Returns { ok, free,
//      used, remaining }.
//   3. Paid path: otherwise, open the $50 Stripe Checkout session. Returns
//      { url } for the browser to redirect to.
//
// The DB RPC re-checks credit availability under a row lock, so a stale
// remaining read in the free path can't cause a double-grant — the worst
// case is we attempt free, the RPC throws NO_FREE_CREDITS, and we fall
// through to the paid path below.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const profile = await requireCreator()
  if (!profile) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  try {
    if (ATTEND_BETA_MODE) {
      const result = await grantBetaRegistration(params.id, profile.id)
      return NextResponse.json(result)
    }
    const remaining = await freeRegistrationsRemaining(profile.id)
    if (remaining > 0) {
      try {
        const result = await grantFreeRegistration(params.id, profile.id)
        return NextResponse.json(result)
      } catch (err) {
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
