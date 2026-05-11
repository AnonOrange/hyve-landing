// Admin-issued comp (complimentary) license keys for Hyve CaseLine.
//
// These are FREE keys an admin generates to give beta-testers, demo
// partners, bar-association observers, internal QA, etc. They behave
// identically to a paid Stripe license at the desktop client — same
// HYVE-XXXX-XXXX-XXXX format, same tier semantics, same seat math —
// but live in this Supabase table instead of Stripe subscription
// metadata.
//
// Lookups in /api/caseline/validate try Stripe first (the paid path),
// then fall through to this table. Revocation is soft (timestamp on an
// existing row) so the desktop can detect a previously-active session
// AND we keep evidence of when/why a key was killed.

import { supaGet, supaPost, supaPatch } from '@/lib/supabase'

export interface CompKeyRow {
  key:                string
  tier:               '5' | '10' | 'custom'
  max_seats:          number
  label:              string | null
  issued_by:          string
  issued_at:          string         // ISO timestamp
  revoked_at:         string | null
  revoked_by:         string | null
  revoked_reason:     string | null
  last_validated_at:  string | null
}

// HYVE-XXXX-XXXX-XXXX — same alphabet + structure as paid keys so the
// desktop validator's regex matches either.
// Excludes ambiguous chars (0/O/1/I/L) so customers can hand-type without
// confusion.
const KEY_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
function genKey(): string {
  const block = () =>
    Array.from({ length: 4 }, () => KEY_ALPHABET[Math.floor(Math.random() * KEY_ALPHABET.length)]).join('')
  return `HYVE-${block()}-${block()}-${block()}`
}

export interface IssueCompKeyInput {
  tier:       '5' | '10' | 'custom'
  max_seats?: number       // defaults from tier; required when tier === 'custom'
  label?:     string | null
  issued_by:  string       // admin email from session
}

export interface IssueResult {
  ok:    true
  key:   string
  row:   CompKeyRow
}

export interface IssueError {
  ok:     false
  error:  string
}

export async function issueCompKey(input: IssueCompKeyInput): Promise<IssueResult | IssueError> {
  const tier = input.tier
  const defaultSeats = tier === '5' ? 5 : tier === '10' ? 10 : 0
  const max_seats = input.max_seats ?? defaultSeats
  if (tier === 'custom' && (!input.max_seats || input.max_seats < 1 || input.max_seats > 9999)) {
    return { ok: false, error: 'custom tier requires max_seats (1-9999)' }
  }
  if (!input.issued_by || !input.issued_by.includes('@')) {
    return { ok: false, error: 'issued_by (admin email) required' }
  }
  const label = input.label?.trim().slice(0, 255) || null
  // Tiny retry loop guards against the vanishing chance of a key
  // collision in our 30^12 = 5×10^17 keyspace.
  for (let attempt = 0; attempt < 3; attempt++) {
    const key = genKey()
    const res = await supaPost(
      'caseline_comp_keys',
      {
        key,
        tier,
        max_seats,
        label,
        issued_by: input.issued_by,
        issued_at: new Date().toISOString(),
      },
      'return=representation',
    )
    if (res.ok) {
      const rows = (await res.json()) as CompKeyRow[]
      const row = rows[0]
      return { ok: true, key, row }
    }
    // 23505 = unique-violation. Anything else = real failure.
    const text = await res.text()
    if (!text.includes('23505')) {
      return { ok: false, error: `supabase rejected insert (${res.status}): ${text.slice(0, 200)}` }
    }
    // collision — retry
  }
  return { ok: false, error: 'failed to mint a unique key after 3 attempts (cosmic ray?)' }
}

export async function listCompKeys(opts?: { onlyActive?: boolean }): Promise<CompKeyRow[]> {
  const filter = opts?.onlyActive ? 'revoked_at=is.null&' : ''
  const r = await supaGet(
    'caseline_comp_keys',
    `${filter}select=*&order=issued_at.desc&limit=500`,
  )
  if (!r.ok) return []
  return (await r.json()) as CompKeyRow[]
}

export async function getCompKey(key: string): Promise<CompKeyRow | null> {
  const r = await supaGet(
    'caseline_comp_keys',
    `key=eq.${encodeURIComponent(key)}&select=*&limit=1`,
  )
  if (!r.ok) return null
  const rows = (await r.json()) as CompKeyRow[]
  return rows[0] ?? null
}

export async function revokeCompKey(
  key: string,
  revoked_by: string,
  reason?: string | null,
): Promise<boolean> {
  // Idempotent: revoking an already-revoked key returns true but doesn't
  // overwrite the original revoked_at — admins can't reset their own
  // audit trail by re-revoking.
  const existing = await getCompKey(key)
  if (!existing) return false
  if (existing.revoked_at) return true
  const r = await supaPatch(
    'caseline_comp_keys',
    `key=eq.${encodeURIComponent(key)}&revoked_at=is.null`,
    {
      revoked_at: new Date().toISOString(),
      revoked_by,
      revoked_reason: reason?.trim().slice(0, 500) || null,
    },
  )
  return r.ok
}

// Hot path: stamp last_validated_at when the desktop polls validate
// with a comp key. Don't block the validate response on this — let it
// fire-and-forget so paid + comp validate at the same latency.
export function touchLastValidated(key: string): void {
  // No await, no .catch — Vercel kills inflight promises after response,
  // but Supabase REST is single-digit ms in the same region. Fine.
  void supaPatch(
    'caseline_comp_keys',
    `key=eq.${encodeURIComponent(key)}`,
    { last_validated_at: new Date().toISOString() },
  ).catch(() => { /* ignore */ })
}
