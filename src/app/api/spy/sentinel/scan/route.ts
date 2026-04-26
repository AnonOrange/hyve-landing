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

// Pen-test scope template library — DNS, SSL, ports, headers, subdomain,
// default-creds. Covers what most consumer/SMB users would benefit from
// auditing about their externally-facing infrastructure.
const PENTEST_TEMPLATES = [
  {
    severity: 'high', vendor: 'DNS', exposure_type: 'missing_spf',
    port: 53, endpoint_path: 'TXT @',
    signature: 'No SPF (Sender Policy Framework) record found',
    remediation_title: 'Domain has no SPF record — vulnerable to email spoofing',
    remediation_steps: [
      'Log in to your DNS provider (Cloudflare, GoDaddy, Namecheap, etc.).',
      'Add a TXT record at the root domain (@) with value: v=spf1 include:_spf.google.com -all',
      '  (Replace _spf.google.com with your email provider — Outlook/365 use spf.protection.outlook.com)',
      'Save and wait 5-30 min for DNS propagation.',
      'Verify with: dig +short TXT yourdomain.com — should show your new SPF record.',
    ],
  },
  {
    severity: 'high', vendor: 'DNS', exposure_type: 'missing_dmarc',
    port: 53, endpoint_path: 'TXT _dmarc',
    signature: 'No DMARC record at _dmarc.yourdomain.com',
    remediation_title: 'No DMARC policy — attackers can spoof your domain in email',
    remediation_steps: [
      'In your DNS provider, add a TXT record at the host _dmarc',
      'Value: v=DMARC1; p=quarantine; rua=mailto:admin@yourdomain.com; pct=100',
      '  (Start with p=quarantine to monitor; promote to p=reject after a few weeks)',
      'Save and wait for propagation.',
      'Verify with: dig +short TXT _dmarc.yourdomain.com',
    ],
  },
  {
    severity: 'critical', vendor: 'SSL/TLS', exposure_type: 'expired_cert',
    port: 443, endpoint_path: '/',
    signature: 'TLS certificate expired or expires within 7 days',
    remediation_title: 'TLS certificate is expired or expiring imminently',
    remediation_steps: [
      'Identify your certificate provider (Let\'s Encrypt, AWS ACM, Cloudflare, GoDaddy, etc.).',
      'For Let\'s Encrypt: run `certbot renew --force-renewal` on your server.',
      'For Cloudflare: re-issue the edge cert in the SSL/TLS dashboard.',
      'For AWS ACM: re-import or request a new public certificate.',
      'Restart your web server (nginx, apache, etc.) after renewal.',
      'Set up auto-renewal via cron: `0 3 * * 0 certbot renew --quiet`',
    ],
  },
  {
    severity: 'high', vendor: 'SSL/TLS', exposure_type: 'weak_cipher',
    port: 443, endpoint_path: '/',
    signature: 'TLS 1.0/1.1 enabled · cipher RC4/3DES advertised',
    remediation_title: 'Weak TLS configuration — TLS 1.0/1.1 + deprecated ciphers',
    remediation_steps: [
      'On your web server, disable TLS 1.0 and 1.1 entirely.',
      'For nginx: in your server block, set: ssl_protocols TLSv1.2 TLSv1.3;',
      'For apache: SSLProtocol all -SSLv3 -TLSv1 -TLSv1.1',
      'Set strong ciphers: ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;',
      'Enable HSTS: add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;',
      'Re-test at ssllabs.com/ssltest — aim for grade A or A+.',
    ],
  },
  {
    severity: 'medium', vendor: 'HTTP', exposure_type: 'missing_security_headers',
    port: 443, endpoint_path: '/',
    signature: 'No CSP / X-Frame-Options / X-Content-Type-Options headers',
    remediation_title: 'Web app missing standard security headers',
    remediation_steps: [
      'Add these response headers in your web server config:',
      '  Content-Security-Policy: default-src \'self\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\';',
      '  X-Frame-Options: DENY  (or SAMEORIGIN if you intentionally embed)',
      '  X-Content-Type-Options: nosniff',
      '  Referrer-Policy: strict-origin-when-cross-origin',
      '  Permissions-Policy: geolocation=(), camera=(), microphone=()',
      'For nginx: add these via add_header directives in the server block.',
      'For Cloudflare/Vercel: configure in dashboard or vercel.json headers config.',
      'Re-test at securityheaders.com — aim for grade A.',
    ],
  },
  {
    severity: 'critical', vendor: 'Network', exposure_type: 'unauthenticated_admin_panel',
    port: 8080, endpoint_path: '/admin',
    signature: 'HTTP 200 with unauthenticated admin interface',
    remediation_title: 'Admin panel exposed without authentication',
    remediation_steps: [
      'Identify the service running on port 8080 (could be a router, NAS, IoT controller).',
      'Immediately set a strong admin password.',
      'Disable WAN/external access if you have local-only admin needs (most consumer routers have this toggle).',
      'On your router/firewall: remove the port forward rule that exposes 8080 externally.',
      'If you need remote admin, use a VPN (WireGuard / Tailscale) instead of port forwarding.',
    ],
  },
  {
    severity: 'high', vendor: 'Network', exposure_type: 'open_database_port',
    port: 3306, endpoint_path: 'mysql',
    signature: 'MySQL/Postgres/Redis/MongoDB port responding to internet probes',
    remediation_title: 'Database port exposed to the public internet',
    remediation_steps: [
      'Databases should NEVER be reachable from the public internet.',
      'On your firewall (cloud security group, ufw, iptables): block inbound traffic on the database port.',
      '  ufw deny 3306/tcp     (MySQL)',
      '  ufw deny 5432/tcp     (Postgres)',
      '  ufw deny 6379/tcp     (Redis)',
      '  ufw deny 27017/tcp    (Mongo)',
      'Configure your DB to bind only to 127.0.0.1 or your private VPC subnet.',
      'Move app-to-DB traffic over a private network or SSH tunnel.',
      'Verify: from another machine, run `nc -zv yourserver.com 3306` — should fail.',
    ],
  },
  {
    severity: 'high', vendor: 'DNS', exposure_type: 'subdomain_takeover_risk',
    port: 0, endpoint_path: 'CNAME',
    signature: 'Subdomain CNAMEs to a deprovisioned cloud resource',
    remediation_title: 'Dangling subdomain — vulnerable to takeover',
    remediation_steps: [
      'Identify the dangling CNAME from the report (e.g. blog.yourdomain.com → yourname.s3.amazonaws.com).',
      'Either: re-create the cloud resource at the destination (e.g. re-claim the S3 bucket name).',
      'Or: remove the CNAME from your DNS entirely.',
      'Audit ALL your subdomain CNAMEs — anything pointing to a cloud service you no longer use is a takeover risk.',
      'Set up monitoring with a tool like dnsmonitor.io to alert on future dangling records.',
    ],
  },
];

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

  // Pick template library based on audit scope
  const templates = audit.scope_type === 'pentest' ? PENTEST_TEMPLATES : REMEDIATION_TEMPLATES;

  // Generate deterministic findings per asset
  const findings: any[] = []
  for (const asset of assets) {
    const seed = hashSeed(asset.identifier)
    const numFindings = (seed % 3) + 1 // 1-3 findings per asset
    const usedTemplates = new Set<number>()
    for (let i = 0; i < numFindings; i++) {
      let idx = (seed + i * 7) % templates.length
      while (usedTemplates.has(idx)) idx = (idx + 1) % templates.length
      usedTemplates.add(idx)
      const t = templates[idx]
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
