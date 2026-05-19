import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export const runtime = 'nodejs'

// Clears the HYVE Attend Supabase Auth session. supabase.auth.signOut()
// triggers setAll with the cleared cookies, which are written onto the
// response that is then returned — so the browser drops the session.
export async function POST() {
  const cookieStore = cookies()
  const response = NextResponse.json({ ok: true })
  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )
  await supabase.auth.signOut()
  return response
}
