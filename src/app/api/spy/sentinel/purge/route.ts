import { NextRequest, NextResponse } from 'next/server'

const SUPA_URL = process.env.SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY!
const CRON_SECRET = process.env.CRON_SECRET

// Daily cron: purges sensitive audit data after the retention window.
//
// What gets purged:
//   - sentinel_audit_assets row.identifier (encrypted, but still gone)
//   - sentinel_findings rows entirely (drops endpoint_path, signature, steps)
//
// What stays for the user's records:
//   - sentinel_audits row with severity_summary (just counts by severity)
//   - audit_id, user_email, tier, agreement_signed_*, scan_completed_at
//   - purged_at (set to NOW so report page shows "data purged" notice)
//
// Retention default: 7 days post-completion. Sized so users have a week to
// fix issues + revisit; after that we have no business holding their exposure
// data on disk where it could leak.
//
// Trigger: Vercel cron at /api/spy/sentinel/purge — daily.
// Auth: Authorization: Bearer ${CRON_SECRET}.

const RETENTION_DAYS = 7

export async function GET(req: NextRequest) {
  const got = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    || req.headers.get('x-cron-secret')
  if (CRON_SECRET && got !== CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()

  // Fetch audits that need purging
  const auditsRes = await fetch(
    `${SUPA_URL}/rest/v1/sentinel_audits?status=eq.complete&purged_at=is.null&scan_completed_at=lt.${cutoff}&select=id`,
    { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } },
  )
  const audits = (await auditsRes.json()) as Array<{ id: string }>

  let purged = 0
  for (const a of audits) {
    // Delete findings entirely
    await fetch(`${SUPA_URL}/rest/v1/sentinel_findings?audit_id=eq.${encodeURIComponent(a.id)}`, {
      method: 'DELETE',
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, Prefer: 'return=minimal' },
    })
    // Null asset identifiers (keep row for audit history but drop the encrypted target)
    await fetch(`${SUPA_URL}/rest/v1/sentinel_audit_assets?audit_id=eq.${encodeURIComponent(a.id)}`, {
      method: 'PATCH',
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: null, verification_token: null }),
    })
    // Mark the audit as purged
    await fetch(`${SUPA_URL}/rest/v1/sentinel_audits?id=eq.${encodeURIComponent(a.id)}`, {
      method: 'PATCH',
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ purged_at: new Date().toISOString() }),
    })
    purged++
  }

  return NextResponse.json({ ok: true, purged, retentionDays: RETENTION_DAYS, cutoff })
}

export const dynamic = 'force-dynamic'
