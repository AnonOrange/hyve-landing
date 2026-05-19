// Browser-side Supabase client for HYVE Attend auth (sign-in / sign-up).
// @supabase/ssr keeps the session in cookies the Phase 1 server helper reads.
'use client'

import { createBrowserClient } from '@supabase/ssr'

export function attendBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
