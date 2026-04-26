import { NextRequest, NextResponse } from 'next/server'
import { decrypt, decryptDeep } from '@/lib/hyveCrypt'

const SUPA_URL = process.env.SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY!

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const auditRes = await fetch(
    `${SUPA_URL}/rest/v1/sentinel_audits?id=eq.${encodeURIComponent(id)}&select=*`,
    { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } },
  )
  const [audit] = await auditRes.json()
  if (!audit) return NextResponse.json({ error: 'audit not found' }, { status: 404 })

  // If audit was purged (post-retention), return summary only — sensitive
  // fields are gone forever. The user has whatever they printed/saved.
  if (audit.purged_at) {
    return NextResponse.json({
      audit,
      assets: [],
      findings: [],
      purged: true,
      severitySummary: audit.severity_summary || {},
    })
  }

  const [assetsRes, findingsRes] = await Promise.all([
    fetch(`${SUPA_URL}/rest/v1/sentinel_audit_assets?audit_id=eq.${encodeURIComponent(id)}&select=*`, {
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    }),
    fetch(`${SUPA_URL}/rest/v1/sentinel_findings?audit_id=eq.${encodeURIComponent(id)}&select=*&order=severity.asc`, {
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    }),
  ])
  const rawAssets = await assetsRes.json()
  const rawFindings = await findingsRes.json()

  // Decrypt sensitive fields server-side before sending to the client browser.
  // The plaintext NEVER lives in the DB — only in this single request's response.
  const assets = rawAssets.map((a: any) => ({
    ...a,
    identifier: decrypt(id, a.identifier),
    display_label: decrypt(id, a.display_label),
  }))
  const findings = rawFindings.map((f: any) => {
    const portStr = decrypt(id, f.port)
    return {
      ...f,
      vendor: decrypt(id, f.vendor),
      exposure_type: decrypt(id, f.exposure_type),
      port: portStr ? parseInt(portStr) || portStr : f.port,
      endpoint_path: decrypt(id, f.endpoint_path),
      signature: decrypt(id, f.signature),
      remediation_title: decrypt(id, f.remediation_title),
      remediation_steps: decryptDeep(id, f.remediation_steps),
    }
  })

  return NextResponse.json({ audit, assets, findings, purged: false })
}

export const dynamic = 'force-dynamic'
