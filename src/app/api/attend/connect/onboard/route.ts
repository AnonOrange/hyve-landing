import { NextRequest, NextResponse } from 'next/server'
import { requireCreator } from '@/lib/attend/identity/roles'
import {
  getOrCreatePayoutAccount,
  createOnboardingLink,
} from '@/lib/attend/payments/connect-service'

export const runtime = 'nodejs'

// POST /api/attend/connect/onboard — start (or continue) Connect onboarding.
export async function POST(req: NextRequest) {
  const profile = await requireCreator()
  if (!profile) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  try {
    const accountId = await getOrCreatePayoutAccount(profile.id, profile.email)
    const url = await createOnboardingLink(accountId, req.nextUrl.origin)
    return NextResponse.json({ url })
  } catch (err) {
    console.error('[attend connect onboard]:', (err as Error).message)
    return NextResponse.json({ error: 'Failed to start Connect onboarding' }, { status: 500 })
  }
}
