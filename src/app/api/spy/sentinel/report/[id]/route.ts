import { NextRequest, NextResponse } from 'next/server'

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

  const [assetsRes, findingsRes] = await Promise.all([
    fetch(`${SUPA_URL}/rest/v1/sentinel_audit_assets?audit_id=eq.${encodeURIComponent(id)}&select=*`, {
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    }),
    fetch(`${SUPA_URL}/rest/v1/sentinel_findings?audit_id=eq.${encodeURIComponent(id)}&select=*&order=severity.asc`, {
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    }),
  ])
  const assets = await assetsRes.json()
  const findings = await findingsRes.json()

  return NextResponse.json({ audit, assets, findings })
}

export const dynamic = 'force-dynamic'
