// TLS probe. Connects to port 443 and inspects the certificate + negotiated
// protocol/cipher. Native node:tls — no external deps.
import * as tls from 'node:tls'
import type { ProbeFinding } from './dns'

/**
 * Probe a host's TLS configuration. Detects:
 *   - Expired or expiring-soon certificates
 *   - Weak protocol versions (TLS 1.0 / 1.1 still supported)
 *   - Self-signed or untrusted certificates
 */
export async function probeTls(host: string): Promise<ProbeFinding[]> {
  const findings: ProbeFinding[] = []
  const cleanHost = host.replace(/^https?:\/\//, '').replace(/\/.*$/, '')

  // 1. Connect with default settings — gets us the live cert + cipher
  const liveResult = await tlsConnect(cleanHost, 443, {})
  if (liveResult.error) {
    return [] // Host doesn't speak TLS at 443; not necessarily a finding
  }

  // Cert expiry
  if (liveResult.certExpiresAt) {
    const daysLeft = Math.floor((liveResult.certExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    if (daysLeft < 0) {
      findings.push({
        severity: 'critical',
        vendor: 'SSL/TLS',
        exposure_type: 'expired_cert',
        port: 443,
        endpoint_path: '/',
        signature: `TLS certificate expired ${Math.abs(daysLeft)} day(s) ago`,
        remediation_title: 'TLS certificate expired',
        remediation_steps: [
          'Identify your certificate provider (Let\'s Encrypt, AWS ACM, Cloudflare, GoDaddy, etc.).',
          'For Let\'s Encrypt: run `certbot renew --force-renewal` on your server.',
          'For Cloudflare: re-issue the edge cert in the SSL/TLS dashboard.',
          'For AWS ACM: re-import or request a new public certificate.',
          'Restart your web server (nginx, apache, etc.) after renewal.',
          'Set up auto-renewal: `0 3 * * 0 certbot renew --quiet` in crontab.',
        ],
      })
    } else if (daysLeft < 14) {
      findings.push({
        severity: 'high',
        vendor: 'SSL/TLS',
        exposure_type: 'cert_expiring_soon',
        port: 443,
        endpoint_path: '/',
        signature: `TLS certificate expires in ${daysLeft} day(s)`,
        remediation_title: `TLS certificate expires in ${daysLeft} day(s)`,
        remediation_steps: [
          'Renew now to avoid downtime.',
          'For Let\'s Encrypt: `certbot renew`',
          'Set up auto-renewal so this doesn\'t happen again.',
        ],
      })
    }
  }

  // Self-signed / untrusted cert
  if (liveResult.untrusted) {
    findings.push({
      severity: 'high',
      vendor: 'SSL/TLS',
      exposure_type: 'untrusted_cert',
      port: 443,
      endpoint_path: '/',
      signature: `Cert chain not trusted: ${liveResult.untrusted}`,
      remediation_title: 'TLS certificate is self-signed or chain not trusted',
      remediation_steps: [
        'Browsers will show a security warning for visitors of your site.',
        'Get a free trusted cert from Let\'s Encrypt: install certbot and run `certbot --nginx` (or --apache).',
        'For Cloudflare-fronted sites: enable "Full (strict)" SSL mode and use Cloudflare\'s origin cert.',
        'For internal-only services, add the issuing CA to clients\' trust stores.',
      ],
    })
  }

  // 2. Probe weak protocol support — try TLS 1.0 and 1.1 explicitly
  for (const proto of ['TLSv1', 'TLSv1.1'] as const) {
    const r = await tlsConnect(cleanHost, 443, {
      minVersion: proto,
      maxVersion: proto,
    })
    if (!r.error) {
      findings.push({
        severity: 'high',
        vendor: 'SSL/TLS',
        exposure_type: 'weak_tls_version',
        port: 443,
        endpoint_path: '/',
        signature: `Server accepts ${proto} connections (deprecated)`,
        remediation_title: `Weak TLS version ${proto} still enabled`,
        remediation_steps: [
          `${proto} is deprecated and was removed from major browsers in 2020.`,
          'Disable TLS 1.0 and 1.1 on your server.',
          'For nginx: ssl_protocols TLSv1.2 TLSv1.3;',
          'For apache: SSLProtocol all -SSLv3 -TLSv1 -TLSv1.1',
          'For Cloudflare: SSL/TLS → Edge Certificates → Minimum TLS Version → 1.2',
          'Re-test at ssllabs.com/ssltest — aim for grade A or A+.',
        ],
      })
      break // one finding for weak proto is enough
    }
  }

  return findings
}

function tlsConnect(
  host: string,
  port: number,
  opts: { minVersion?: 'TLSv1' | 'TLSv1.1' | 'TLSv1.2'; maxVersion?: 'TLSv1' | 'TLSv1.1' | 'TLSv1.2' | 'TLSv1.3' },
): Promise<{ error?: string; certExpiresAt?: Date; untrusted?: string; cipher?: string; protocol?: string }> {
  return new Promise((resolve) => {
    const socket = tls.connect({
      host,
      port,
      servername: host,
      timeout: 5000,
      rejectUnauthorized: false, // we want to inspect even untrusted certs
      ...opts,
    })
    let resolved = false
    const finish = (r: any) => { if (!resolved) { resolved = true; try { socket.destroy() } catch {} ; resolve(r) } }
    socket.once('secureConnect', () => {
      const cert = socket.getPeerCertificate()
      const protocol = socket.getProtocol() || undefined
      const cipher = socket.getCipher()?.name
      const expiresAt = cert?.valid_to ? new Date(cert.valid_to) : undefined
      const authorized = (socket as any).authorized
      const authError = (socket as any).authorizationError
      finish({
        certExpiresAt: expiresAt,
        protocol,
        cipher,
        untrusted: authorized ? undefined : (authError || 'unauthorized'),
      })
    })
    socket.once('error', (err) => finish({ error: err.message }))
    socket.once('timeout', () => finish({ error: 'timeout' }))
  })
}
