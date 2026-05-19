// Raw-REST data access for attend_profiles and attend_artist_profiles.
// Query-only — no business logic. Server-side only (service-key reads).
import { supaGet } from '@/lib/supabase'

export interface ProfileRow {
  id: string
  display_name: string
  email: string
  role: string
  avatar_url: string | null
}

export interface ArtistProfileRow {
  id: string
  profile_id: string
  stage_name: string
  bio: string | null
  avatar_url: string | null
  links: Record<string, unknown>
}

export async function getProfileById(id: string): Promise<ProfileRow | null> {
  const res = await supaGet('attend_profiles', `id=eq.${id}&select=*`)
  if (!res.ok) throw new Error(`attend_profiles query failed: ${res.status}`)
  const r = (await res.json()) as ProfileRow[]
  return r[0] ?? null
}

export async function getArtistProfileByProfileId(
  profileId: string,
): Promise<ArtistProfileRow | null> {
  const res = await supaGet('attend_artist_profiles', `profile_id=eq.${profileId}&select=*`)
  if (!res.ok) throw new Error(`attend_artist_profiles query failed: ${res.status}`)
  const r = (await res.json()) as ArtistProfileRow[]
  return r[0] ?? null
}
