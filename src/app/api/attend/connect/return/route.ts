import { NextRequest, NextResponse } from 'next/server'
import { requireCreator } from '@/lib/attend/identity/roles'
import {
  getOrCreatePayoutAccount,
  syncAccountStatus,
} from '@/lib/attend/payments/connect-service'

export const runtime = 'nodejs'

// GET /api/attend/connect/return — Stripe redirects here after onboarding.
export async function GET(req: NextRequest) {
  const profile = await requireCreator()
  if (!profile) return NextResponse.redirect(`${req.nextUrl.origin}/attend/login`)
  try {
    const accountId = await getOrCreatePayoutAccount(profile.id, profile.email)
    await syncAccountStatus(accountId)
  } catch (err) {
    console.error('[attend connect return]:', (err as Error).message)
  }
  return NextResponse.redirect(`${req.nextUrl.origin}/attend/creator?connect=done`)
}
