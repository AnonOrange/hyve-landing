import { NextRequest, NextResponse } from 'next/server'
import { requireCreator } from '@/lib/attend/identity/roles'
import {
  getOrCreatePayoutAccount,
  createOnboardingLink,
} from '@/lib/attend/payments/connect-service'

export const runtime = 'nodejs'

// GET /api/attend/connect/refresh — Stripe redirects here when the onboarding
// link expired; mint a fresh one and send the creator back into the flow.
export async function GET(req: NextRequest) {
  const profile = await requireCreator()
  if (!profile) return NextResponse.redirect(`${req.nextUrl.origin}/attend/login`)
  try {
    const accountId = await getOrCreatePayoutAccount(profile.id, profile.email)
    const url = await createOnboardingLink(accountId, req.nextUrl.origin)
    return NextResponse.redirect(url)
  } catch (err) {
    console.error('[attend connect refresh]:', (err as Error).message)
    return NextResponse.redirect(`${req.nextUrl.origin}/attend/creator?connect=error`)
  }
}
