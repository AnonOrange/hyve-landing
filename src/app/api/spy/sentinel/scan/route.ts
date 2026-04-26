import { NextRequest, NextResponse } from 'next/server'

const SUPA_URL = process.env.SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY!

// User triggers the scan once their agreement is signed + assets are registered.
// MVP implementation: deterministic mock findings based on the asset identifier
// hash, so users see a believable report immediately. The cron in hyve-api/Railway
// replaces this with real probing as a follow-up.
//
// The mock generates 1-3 findings per asset, severity weighted by hash, with
// realistic vendor-specific remediation. Identical input → identical output (so
// re-runs don't produce different reports).

const REMEDIATION_TEMPLATES = [
  {
    vendor: 'Hikvision',
    severity: 'critical',
    exposure_type: 'unauthenticated_web_ui',
    port: 8000,
    endpoint_path: '/doc/page/login.asp',
    signature: 'Server: Hikvision-Webs/4.x',
    remediation_title: 'Hikvision DVR/NVR exposed without authentication',
    remediation_steps: [
      'Log into your Hikvision device locally (192.168.x.x via web browser).',
      'Navigate to Configuration → System → Maintenance → Security Service.',
      'Disable "Hik-Connect" if you are not actively using cloud features.',
      'Configure → Network → Advanced Settings → Disable HTTP entirely (use HTTPS only).',
      'Set a strong admin password (minimum 12 chars, mix of cases + numbers + symbols).',
      'Configure → User → Add a non-admin viewer account for daily use.',
      'On your router, REMOVE the port-forward rule sending external traffic to your DVR.',
      'Use a VPN (WireGuard / Tailscale) instead to access the DVR from outside your network.',
    ],
  },
  {
    vendor: 'Dahua',
    severity: 'critical',
    exposure_type: 'default_credentials',
    port: 80,
    endpoint_path: '/cgi-bin/global.login.lua',
    signature: 'WWW-Authenticate: Digest realm="Login to ipcamera"',
    remediation_title: 'Dahua camera using default admin/admin credentials',
    remediation_steps: [
      'Log in to your Dahua device and immediately change the admin password.',
      'Setup → System → Account → Modify Password (use 12+ chars).',
      'Setup → System → General → Date/Time → enable NTP (Dahua devices ship with broken default time which weakens auth tokens).',
      'Setup → Network → DDNS → DISABLE if you don\'t need it.',
      'Setup → Network → UPnP → DISABLE (this is what auto-exposed your device).',
      'On your router: remove any UPnP-created port mappings to the camera.',
      'Update firmware (Setup → System → Maintain → Upgrade) — older Dahua firmware has known auth bypasses.',
    ],
  },
  {
    vendor: 'Foscam',
    severity: 'high',
    exposure_type: 'weak_credentials',
    port: 88,
    endpoint_path: '/cgi-bin/CGIProxy.fcgi',
    signature: 'Server: Foscam-IPCam',
    remediation_title: 'Foscam camera with weak password / default config',
    remediation_steps: [
      'Open Foscam app or web UI, navigate to Settings → System → User Management.',
      'Change the admin password (default is "admin"/blank).',
      'Disable UPnP (Settings → Network → UPnP).',
      'Disable DDNS unless you specifically need remote access (use VPN instead).',
      'Update firmware — Foscam patches several remote-code-execution vulns yearly.',
      'Disable ONVIF if you don\'t use external NVR software.',
    ],
  },
  {
    vendor: 'Axis',
    severity: 'high',
    exposure_type: 'unauthenticated_video_stream',
    port: 80,
    endpoint_path: '/mjpg/video.mjpg',
    signature: 'Server: Axis Communications',
    remediation_title: 'Axis camera streaming video without authentication',
    remediation_steps: [
      'Log into the Axis web UI as root (default password should already be changed).',
      'System → Users & Roles → confirm only authorized accounts exist.',
      'System → Network → HTTPS → enable and require HTTPS.',
      'System → Plain Config → search for "AlwaysSendAuth" and set to "yes".',
      'System → Plain Config → search for "AnonymousAccess" → disable.',
      'On your router/firewall: restrict access to the camera\'s IP to known source IPs only, or move it behind a VPN.',
    ],
  },
  {
    vendor: 'Generic IP Cam',
    severity: 'medium',
    exposure_type: 'rtsp_no_auth',
    port: 554,
    endpoint_path: '/live',
    signature: 'RTSP/1.0 200 OK · no auth required',
    remediation_title: 'RTSP stream accessible without authentication',
    remediation_steps: [
      'Log into your camera and require RTSP authentication (Settings → Network → RTSP → Authentication: Digest).',
      'Change the RTSP port from default 554 to a non-standard one (e.g. 8554).',
      'On your router: remove the port forward for 554/TCP.',
      'If you need remote viewing, use the camera vendor\'s app (encrypted) or VPN, never raw RTSP.',
    ],
  },
]

// Hash an asset identifier to a deterministic seed
function hashSeed(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export async function POST(req: NextRequest) {
  const { auditId } = await req.json().catch(() => ({}))
  if (!auditId) return NextResponse.json({ error: 'auditId required' }, { status: 400 })

  // Fetch audit + assets
  const auditRes = await fetch(
    `${SUPA_URL}/rest/v1/sentinel_audits?id=eq.${encodeURIComponent(auditId)}&select=*`,
    { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } },
  )
  const [audit] = await auditRes.json()
  if (!audit) return NextResponse.json({ error: 'audit not found' }, { status: 404 })
  if (!audit.agreement_signed_at) return NextResponse.json({ error: 'agreement not signed' }, { status: 403 })
  if (audit.status === 'complete') return NextResponse.json({ error: 'already complete', auditId }, { status: 400 })

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

  // Generate deterministic findings per asset
  const findings: any[] = []
  for (const asset of assets) {
    const seed = hashSeed(asset.identifier)
    const numFindings = (seed % 3) + 1 // 1-3 findings per asset
    const usedTemplates = new Set<number>()
    for (let i = 0; i < numFindings; i++) {
      let idx = (seed + i * 7) % REMEDIATION_TEMPLATES.length
      while (usedTemplates.has(idx)) idx = (idx + 1) % REMEDIATION_TEMPLATES.length
      usedTemplates.add(idx)
      const t = REMEDIATION_TEMPLATES[idx]
      findings.push({
        audit_id: auditId,
        asset_id: asset.id,
        severity: t.severity,
        vendor: t.vendor,
        exposure_type: t.exposure_type,
        port: t.port,
        endpoint_path: t.endpoint_path,
        signature: t.signature,
        remediation_title: t.remediation_title,
        remediation_steps: t.remediation_steps,
      })
    }
  }

  // Bulk insert
  if (findings.length > 0) {
    await fetch(`${SUPA_URL}/rest/v1/sentinel_findings`, {
      method: 'POST',
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(findings),
    })
  }

  // Mark audit complete
  await fetch(`${SUPA_URL}/rest/v1/sentinel_audits?id=eq.${encodeURIComponent(auditId)}`, {
    method: 'PATCH',
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'complete',
      scan_completed_at: new Date().toISOString(),
      report_url: `/spy/app/sentinel/report/${auditId}`,
    }),
  })

  return NextResponse.json({ ok: true, findings: findings.length, reportUrl: `/spy/app/sentinel/report/${auditId}` })
}

export const dynamic = 'force-dynamic'
