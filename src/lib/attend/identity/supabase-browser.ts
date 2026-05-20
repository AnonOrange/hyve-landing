// Browser-side Supabase client for HYVE Attend auth (sign-in / sign-up).
// @supabase/ssr keeps the session in cookies the Phase 1 server helper reads.
'use client'

import { createBrowserClient } from '@supabase/ssr'

export function attendBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  // Explicit error beats createBrowserClient's "supabaseUrl is required" —
  // tells the operator exactly which env var to set.
  if (!url || !key) {
    throw new Error(
      'HYVE Attend auth misconfigured: NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY must be set at build time on Vercel ' +
        '(not just SUPABASE_URL/SUPABASE_ANON_KEY — the NEXT_PUBLIC_ prefix ' +
        'is what inlines the value into the client bundle).',
    )
  }
  return createBrowserClient(url, key)
}
