// HTTP security-header + admin-panel probe. Single GET to https://<host>/ and
// to a few common admin paths. Detects missing security headers and exposed
// unauthenticated admin interfaces.
import type { ProbeFinding } from './dns'

const REQUIRED_HEADERS = [
  { name: 'strict-transport-security', display: 'HSTS', critical: false },
  { name: 'content-security-policy',   display: 'CSP', critical: false },
  { name: 'x-frame-options',           display: 'X-Frame-Options', critical: false },
  { name: 'x-content-type-options',    display: 'X-Content-Type-Options', critical: false },
  { name: 'referrer-policy',           display: 'Referrer-Policy', critical: false },
]

export async function probeHttpHeaders(host: string): Promise<ProbeFinding[]> {
  const findings: ProbeFinding[] = []
  const url = host.startsWith('http') ? host : `https://${host}/`

  let res: Response | null = null
  try {
    res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    return findings
  }

  // Collect missing headers
  const missing: string[] = []
  for (const h of REQUIRED_HEADERS) {
    if (!res.headers.get(h.name)) missing.push(h.display)
  }

  if (missing.length >= 3) {
    findings.push({
      severity: missing.length >= 4 ? 'medium' : 'low',
      vendor: 'HTTP',
      exposure_type: 'missing_security_headers',
      port: 443,
      endpoint_path: '/',
      signature: `Missing: ${missing.join(', ')}`,
      remediation_title: 'Web app missing standard security headers',
      remediation_steps: [
        'Add these response headers in your web server config:',
        '  Content-Security-Policy: default-src \'self\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\';',
        '  X-Frame-Options: DENY  (or SAMEORIGIN if you intentionally embed)',
        '  X-Content-Type-Options: nosniff',
        '  Referrer-Policy: strict-origin-when-cross-origin',
        '  Strict-Transport-Security: max-age=31536000; includeSubDomains',
        'For nginx: add via `add_header` directives in the server block.',
        'For Cloudflare: configure Transform Rules → Modify Response Headers.',
        'For Vercel: add to vercel.json `headers` config.',
        'Re-test at securityheaders.com — aim for grade A.',
      ],
    })
  }

  // Server header banner check — sometimes leaks server software version
  const server = res.headers.get('server')
  if (server && /\d+\.\d+\.\d+/.test(server)) {
    findings.push({
      severity: 'low',
      vendor: 'HTTP',
      exposure_type: 'server_version_leak',
      port: 443,
      endpoint_path: '/',
      signature: `Server header: ${server}`,
      remediation_title: 'Server software version leaked in HTTP response',
      remediation_steps: [
        'The Server response header reveals the exact software + version, helping attackers identify known CVEs.',
        'For nginx: `server_tokens off;` in the main http block.',
        'For apache: `ServerTokens Prod` in main config.',
        'For Cloudflare: it will mask the origin Server header automatically when proxied.',
      ],
    })
  }

  return findings
}

/**
 * Probe common admin-panel paths. Many SMB devices expose /admin without auth
 * because operators removed the password "for convenience" or never set one.
 */
export async function probeAdminPanels(host: string): Promise<ProbeFinding[]> {
  const findings: ProbeFinding[] = []
  const candidates = [
    { port: 80,   path: '/admin/' },
    { port: 80,   path: '/login.php' },
    { port: 8080, path: '/' },
    { port: 8080, path: '/admin/' },
    { port: 81,   path: '/' },
  ]

  for (const c of candidates) {
    const url = `http://${host}:${c.port}${c.path}`
    try {
      const r = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(5000), redirect: 'manual' })
      const body = await r.text().catch(() => '')
      const lower = body.toLowerCase()
      // Heuristic: 200 + admin keywords + no login challenge
      if (r.status === 200 &&
          (lower.includes('admin') || lower.includes('configuration') || lower.includes('settings')) &&
          !lower.includes('please log in') && !lower.includes('username') &&
          !r.headers.get('www-authenticate')) {
        findings.push({
          severity: 'critical',
          vendor: 'Network',
          exposure_type: 'unauthenticated_admin_panel',
          port: c.port,
          endpoint_path: c.path,
          signature: `HTTP 200 admin-keyword response on ${url}`,
          remediation_title: `Admin interface on port ${c.port} exposed without authentication`,
          remediation_steps: [
            `Identify the service running on port ${c.port} (could be a router, NAS, IoT controller, IP camera).`,
            'Set a strong admin password immediately.',
            'Disable WAN/external access — most consumer routers have this toggle.',
            `On your router/firewall: remove the port forward for ${c.port}.`,
            'For remote admin needs, use a VPN (WireGuard / Tailscale) instead of port forwarding.',
            'If this is a forgotten device, factory-reset and re-secure or remove from network.',
          ],
        })
        break // one finding per host is enough
      }
    } catch { /* port closed or timeout, skip */ }
  }
  return findings
}
