import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { encrypt, decrypt } from '@/lib/hyveCrypt'

const SUPA_URL = process.env.SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY!

// GET ?audit=<uuid> — list assets for an audit
// POST { auditId, assetType, identifier, displayLabel } — register a new asset
// Verification:
//   - Domain assets get a verification_token; user must add a TXT record
//     "hyve-sentinel-verify=<token>" before we'll scan
//   - IP / cidr / camera_serial assets are auto-marked verified because the
//     authorization agreement covers them — the user attests they own the asset

export async function GET(req: NextRequest) {
  const auditId = req.nextUrl.searchParams.get('audit')
  if (!auditId) return NextResponse.json({ error: 'audit required' }, { status: 400 })
  const r = await fetch(
    `${SUPA_URL}/rest/v1/sentinel_audit_assets?audit_id=eq.${encodeURIComponent(auditId)}&order=added_at.desc`,
    { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } },
  )
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  // Decrypt identifier for display
  const rows = (await r.json()) as Array<any>
  const decrypted = rows.map((a) => ({ ...a, identifier: decrypt(auditId, a.identifier) }))
  return NextResponse.json({ assets: decrypted })
}

export async function POST(req: NextRequest) {
  const { auditId, assetType, identifier, displayLabel } = await req.json().catch(() => ({}))
  if (!auditId || !assetType || !identifier) {
    return NextResponse.json({ error: 'auditId, assetType, identifier required' }, { status: 400 })
  }

  // Quota check — fetch audit + count existing assets, reject if at quota
  const auditRes = await fetch(
    `${SUPA_URL}/rest/v1/sentinel_audits?id=eq.${encodeURIComponent(auditId)}&select=asset_quota,agreement_signed_at`,
    { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } },
  )
  const [audit] = (await auditRes.json()) as Array<{ asset_quota: number; agreement_signed_at: string | null }>
  if (!audit) return NextResponse.json({ error: 'audit not found' }, { status: 404 })
  if (!audit.agreement_signed_at) return NextResponse.json({ error: 'agreement must be signed first' }, { status: 403 })

  const countRes = await fetch(
    `${SUPA_URL}/rest/v1/sentinel_audit_assets?audit_id=eq.${encodeURIComponent(auditId)}&select=id`,
    { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, Prefer: 'count=exact' } },
  )
  const range = countRes.headers.get('content-range') // "0-N/total"
  const existing = parseInt(range?.split('/')[1] || '0')
  if (existing >= audit.asset_quota) {
    return NextResponse.json({ error: 'quota exceeded', quota: audit.asset_quota, existing }, { status: 403 })
  }

  const isDomain = assetType === 'domain'
  const token = isDomain ? `hyve-sentinel-${randomBytes(8).toString('hex')}` : null
  // Encrypt the asset identifier so it's not sitting in DB rows in plaintext.
  // The display_label stays plaintext since it's user-chosen and harmless.
  const cleanIdentifier = String(identifier).trim().toLowerCase().slice(0, 200)
  const row = {
    audit_id: auditId,
    asset_type: assetType,
    identifier: encrypt(auditId, cleanIdentifier),
    display_label: displayLabel || null,
    verification_status: isDomain ? 'pending' : 'verified',
    verification_token: token,
    verified_at: isDomain ? null : new Date().toISOString(),
  }
  const r = await fetch(`${SUPA_URL}/rest/v1/sentinel_audit_assets`, {
    method: 'POST',
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(row),
  })
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  const [asset] = await r.json()
  // Return decrypted identifier so the wizard can display what was added
  if (asset) asset.identifier = decrypt(auditId, asset.identifier)
  return NextResponse.json({ asset })
}

export const dynamic = 'force-dynamic'
