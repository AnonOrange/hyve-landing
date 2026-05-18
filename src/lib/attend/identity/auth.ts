// HYVE Attend auth — reads the Supabase Auth session server-side and
// lazily provisions an attend_profiles row. Attend-only: it does not
// touch Spy/CaseLine auth.

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { supaGet, supaPost } from '@/lib/supabase'

export interface AttendUser {
  id: string
  email: string
}

/** The signed-in Supabase user, or null if not authenticated. */
export async function getAttendUser(): Promise<AttendUser | null> {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {
          /* read-only in Server Components; session refresh handled at route level */
        },
      },
    },
  )
  const { data } = await supabase.auth.getUser()
  if (!data.user || !data.user.email) return null
  return { id: data.user.id, email: data.user.email }
}

/**
 * Ensure an attend_profiles row exists for this user. Idempotent — safe to
 * call on every authenticated Attend request. Returns the profile id.
 */
export async function ensureProfile(user: AttendUser): Promise<string> {
  const res = await supaGet('attend_profiles', `id=eq.${user.id}&select=id`)
  const rows = (await res.json()) as { id: string }[]
  if (rows.length > 0) return rows[0].id

  await supaPost(
    'attend_profiles',
    {
      id: user.id,
      email: user.email,
      display_name: user.email.split('@')[0],
      role: 'USER',
    },
    'return=minimal',
  )
  return user.id
}
