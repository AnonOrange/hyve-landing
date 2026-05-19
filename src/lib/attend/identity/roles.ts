// Server-side: resolve the current Attend user to a profile and ensure the
// CREATOR role. Used by every creator-only route handler and page.
import { getAttendUser, ensureProfile } from '@/lib/attend/identity/auth'
import { supaGet, supaPatch } from '@/lib/supabase'

export interface CreatorProfile {
  id: string
  email: string
  role: string
}

/**
 * Returns the current user's profile with the CREATOR role guaranteed.
 * Promotes a USER to CREATOR on first creator action (self-serve creators).
 * Returns null if not authenticated.
 */
export async function requireCreator(): Promise<CreatorProfile | null> {
  const user = await getAttendUser()
  if (!user) return null
  await ensureProfile(user)

  const res = await supaGet('attend_profiles', `id=eq.${user.id}&select=id,email,role`)
  if (!res.ok) throw new Error(`attend_profiles lookup failed: ${res.status}`)
  const rows = (await res.json()) as CreatorProfile[]
  if (rows.length === 0) return null
  const profile = rows[0]

  if (profile.role === 'USER') {
    await supaPatch('attend_profiles', `id=eq.${user.id}`, { role: 'CREATOR' })
    profile.role = 'CREATOR'
  }
  return profile
}
