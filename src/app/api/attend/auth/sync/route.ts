import { NextResponse } from 'next/server'
import { getAttendUser, ensureProfile } from '@/lib/attend/identity/auth'

export const runtime = 'nodejs'

// Called by the client right after sign-in / sign-up so the attend_profiles
// row exists before the user reaches a creator page.
export async function POST() {
  const user = await getAttendUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  await ensureProfile(user)
  return NextResponse.json({ ok: true })
}
