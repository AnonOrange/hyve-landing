import { NextRequest, NextResponse } from 'next/server'
import { probeDns, type ProbeFinding } from './probes/dns'
import { probeTls } from './probes/tls'
import { probeHttpHeaders, probeAdminPanels } from './probes/http'
import { probeCameraVendors } from './probes/camera'
import { probeDatabasePorts } from './probes/ports'
import { encrypt, decrypt, encryptDeep } from '@/lib/hyveCrypt'

const SUPA_URL = process.env.SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY!

// Real probing orchestrator. Runs the appropriate probe set for the audit's
// scope_type against each registered asset. Probes are network-only (DNS, TLS,
// TCP connect, single HTTP GET) — non-disruptive, identical-shape to normal
// user traffic, fits Vercel's 60s function budget for typical asset counts.
//
// Scope mapping:
//   cameras  → probeCameraVendors (Hikvision/Dahua/Foscam/Axis vendor probes)
//   pentest  → probeDns + probeTls + probeHttpHeaders + probeAdminPanels +
//              probeDatabasePorts
//
// Each probe returns 0..N ProbeFindings. We collect them all, persist them
// against the audit, mark the audit complete, return the report URL.

export const maxDuration = 60 // seconds — Vercel hobby cap

export async function POST(req: NextRequest) {
  const { auditId } = await req.json().catch(() => ({}))
  if (!auditId) return NextResponse.json({ error: 'auditId required' }, { status: 400 })

  const auditRes = await fetch(
    `${SUPA_URL}/rest/v1/sentinel_audits?id=eq.${encodeURIComponent(auditId)}&select=*`,
    { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } },
  )
  const [audit] = await auditRes.json()
  if (!audit) return NextResponse.json({ error: 'audit not found' }, { status: 404 })
  if (!audit.agreement_signed_at) return NextResponse.json({ error: 'agreement not signed' }, { status: 403 })
  if (audit.status === 'complete') {
    return NextResponse.json({
      ok: true,
      reportUrl: `/spy/app/sentinel/report/${auditId}`,
      alreadyComplete: true,
    })
  }

  const assetsRes = await fetch(
    `${SUPA_URL}/rest/v1/sentinel_audit_assets?audit_id=eq.${encodeURIComponent(auditId)}&select=*`,
    { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } },
  )
  const assets = await assetsRes.json()
  if (assets.length === 0) return NextResponse.json({ error: 'no assets registered' }, { status: 400 })

  // Mark audit as scanning
  await fetch(`${SUPA_URL}/rest/v1/sentinel_audits?id=eq.${encodeURIComponent(auditId)}`, {
    method: 'PATCH',
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'scanning', scan_started_at: new Date().toISOString() }),
  })

  // Run probes per asset, in parallel across assets
  const allFindings: any[] = []
  await Promise.all(assets.map(async (asset: any) => {
    // Decrypt the asset identifier in-memory only for the probe — never logged.
    const target = decrypt(auditId, asset.identifier) || ''
    if (!target) return
    let findings: ProbeFinding[] = []

    try {
      if (audit.scope_type === 'pentest') {
        // Pen-test scope: DNS + TLS + HTTP + admin panels + DB ports
        const [dns, tls, http, admin, ports] = await Promise.all([
          probeDns(target).catch(() => []),
          probeTls(target).catch(() => []),
          probeHttpHeaders(target).catch(() => []),
          probeAdminPanels(target).catch(() => []),
          probeDatabasePorts(target).catch(() => []),
        ])
        findings = [...dns, ...tls, ...http, ...admin, ...ports]
      } else {
        // Camera scope: vendor-specific probes + database port leak (because
        // exposed DBs near a camera are unfortunately common)
        const [cams, ports] = await Promise.all([
          probeCameraVendors(target).catch(() => []),
          probeDatabasePorts(target).catch(() => []),
        ])
        findings = [...cams, ...ports]
      }
    } catch (e) {
      // per-asset error doesn't kill the whole scan
      console.warn(`[sentinel/scan] asset ${asset.id} probe failed:`, e)
    }

    for (const f of findings) {
      // Hyve Encryption: every sensitive finding field goes through AES-256-GCM
      // with a per-audit derived key. The ONLY plaintext field is `severity`
      // (4 enum values: critical/high/medium/low) because we count them in the
      // severity_summary which must survive the post-retention purge.
      // port + vendor + exposure_type are encrypted because in combination they
      // reveal what was found and where — the same data that re-enables attack.
      allFindings.push({
        audit_id: auditId,
        asset_id: asset.id,
        severity: f.severity,
        vendor: encrypt(auditId, f.vendor),
        exposure_type: encrypt(auditId, f.exposure_type),
        port: encrypt(auditId, String(f.port)),
        endpoint_path: encrypt(auditId, f.endpoint_path),
        signature: encrypt(auditId, f.signature),
        remediation_title: encrypt(auditId, f.remediation_title),
        remediation_steps: encryptDeep(auditId, f.remediation_steps),
      })
    }
  }))

  // Bulk insert findings
  if (allFindings.length > 0) {
    await fetch(`${SUPA_URL}/rest/v1/sentinel_findings`, {
      method: 'POST',
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(allFindings),
    })
  }

  // Severity summary stays in plaintext so we can render audit history (count
  // by severity) even after the per-finding details are purged at retention end.
  const severitySummary: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 }
  for (const f of allFindings) severitySummary[f.severity] = (severitySummary[f.severity] || 0) + 1

  // Mark audit complete
  await fetch(`${SUPA_URL}/rest/v1/sentinel_audits?id=eq.${encodeURIComponent(auditId)}`, {
    method: 'PATCH',
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'complete',
      scan_completed_at: new Date().toISOString(),
      report_url: `/spy/app/sentinel/report/${auditId}`,
      severity_summary: severitySummary,
    }),
  })

  return NextResponse.json({
    ok: true,
    findingsCount: allFindings.length,
    assetsScanned: assets.length,
    reportUrl: `/spy/app/sentinel/report/${auditId}`,
  })
}

export const dynamic = 'force-dynamic'
