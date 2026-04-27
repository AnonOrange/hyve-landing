// Comp-access allowlist — emails granted free lifetime Pro access to Hyve Spy.
//
// Two layers stacked:
//   1. HARDCODED_COMP — owner email(s) baked into source. Permanent + can't
//      be revoked from the admin UI. Insurance against admins accidentally
//      revoking owner access.
//   2. comp_access_emails Supabase table — admin-managed, dynamically
//      grantable + revocable from the /admin/users panel.
//
// All comp checks consult BOTH layers — hardcoded first (avoid a DB roundtrip
// for the owner's hot path), then the DB.
//
// Flow when a comp-emailed user signs in:
//   - /api/spy/sign-in calls isCompEmail(email) → true
//   - mints a `comp:<email>` session cookie
//   - /api/spy/verify-session sees the `comp:` prefix → returns tier='pro',
//     active=true, status='comp'
//   - Pro features unlock everywhere; no Stripe charge, ever

import { supaGet, supaPost, supaPatch } from '@/lib/supabase'

// Hardcoded comp emails — these are NEVER revocable from the admin UI.
// Owners only. Update this set if a new owner needs permanent access.
const HARDCODED_COMP = new Set<string>([
  'vibesoftwaresolutions@gmail.com',
])

export async function isCompEmail(email: string): Promise<boolean> {
  const lower = email.toLowerCase().trim()
  if (HARDCODED_COMP.has(lower)) return true
  const r = await supaGet(
    'comp_access_emails',
    `email=eq.${encodeURIComponent(lower)}&active=eq.true&select=email`,
  )
  if (!r.ok) return false
  const rows = (await r.json()) as Array<{ email: string }>
  return rows.length > 0
}

export interface CompEmailRow {
  email: string
  granted_by: string
  granted_at: string
  notes: string | null
  active: boolean
  hardcoded?: boolean
}

export async function listCompEmails(): Promise<CompEmailRow[]> {
  const r = await supaGet(
    'comp_access_emails',
    'select=email,granted_by,granted_at,notes,active&order=granted_at.desc',
  )
  const dynamic: CompEmailRow[] = r.ok ? ((await r.json()) as CompEmailRow[]) : []
  // Surface hardcoded entries with a synthetic row so admins SEE them but
  // can't revoke (UI checks the `hardcoded` flag).
  const hardcoded: CompEmailRow[] = Array.from(HARDCODED_COMP).map((email) => ({
    email,
    granted_by: 'system',
    granted_at: '0001-01-01T00:00:00Z',
    notes: 'Owner — baked into source',
    active: true,
    hardcoded: true,
  }))
  return [...hardcoded, ...dynamic]
}

export async function grantCompAccess(
  email: string,
  granted_by: string,
  notes?: string | null,
): Promise<boolean> {
  const lower = email.toLowerCase().trim()
  if (HARDCODED_COMP.has(lower)) return true // already permanent
  // Upsert pattern via Prefer: resolution=merge-duplicates → INSERTs new
  // or updates existing (e.g. re-activates a previously revoked email).
  const r = await supaPost(
    'comp_access_emails',
    {
      email: lower,
      granted_by,
      granted_at: new Date().toISOString(),
      notes: notes || null,
      active: true,
    },
    'resolution=merge-duplicates,return=minimal',
  )
  return r.ok
}

export async function revokeCompAccess(email: string): Promise<boolean> {
  const lower = email.toLowerCase().trim()
  // Hardcoded emails can't be revoked.
  if (HARDCODED_COMP.has(lower)) return false
  const r = await supaPatch(
    'comp_access_emails',
    `email=eq.${encodeURIComponent(lower)}`,
    { active: false },
  )
  return r.ok
}
