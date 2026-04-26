// DNS-layer probes for Sentinel/Scout. Uses Node's built-in resolvers via the
// promisified API — works in Vercel's edge/node runtime without external deps.
import { promises as dns } from 'node:dns'

export type ProbeFinding = {
  severity: 'critical' | 'high' | 'medium' | 'low'
  vendor: string
  exposure_type: string
  port: number
  endpoint_path: string
  signature: string
  remediation_title: string
  remediation_steps: string[]
}

/**
 * Probe SPF + DMARC + CAA + dangling-CNAME for subdomain-takeover risk.
 * Returns 0..N findings — one per missing/misconfigured DNS feature.
 */
export async function probeDns(domain: string): Promise<ProbeFinding[]> {
  const findings: ProbeFinding[] = []
  const root = stripWww(domain)

  // SPF check — any TXT record at root that starts with v=spf1
  try {
    const txt = await dns.resolveTxt(root)
    const flat = txt.map((r) => r.join(''))
    const hasSpf = flat.some((r) => /^v=spf1/i.test(r))
    if (!hasSpf) {
      findings.push({
        severity: 'high',
        vendor: 'DNS',
        exposure_type: 'missing_spf',
        port: 53,
        endpoint_path: `TXT @${root}`,
        signature: 'No v=spf1 record found in domain TXT',
        remediation_title: `${root} has no SPF record — vulnerable to email spoofing`,
        remediation_steps: [
          `Log in to your DNS provider (Cloudflare, GoDaddy, Namecheap, Route53, etc.).`,
          `Add a TXT record at the root domain (@) for ${root}.`,
          `Value: v=spf1 include:_spf.google.com -all  (substitute your email provider's include directive — Microsoft 365 uses spf.protection.outlook.com)`,
          `Save and wait 5-30 min for DNS propagation.`,
          `Verify with: dig +short TXT ${root}  — should show your new SPF record.`,
        ],
      })
    }
  } catch (e: any) {
    // ENODATA = no TXT records at all → still missing SPF
    if (e.code === 'ENODATA' || e.code === 'ENOTFOUND') {
      findings.push({
        severity: 'high',
        vendor: 'DNS',
        exposure_type: 'missing_spf',
        port: 53,
        endpoint_path: `TXT @${root}`,
        signature: `No TXT records at all on ${root}`,
        remediation_title: `${root} has no SPF record — vulnerable to email spoofing`,
        remediation_steps: [
          `Add a TXT record at @ in your DNS provider.`,
          `Value: v=spf1 include:_spf.google.com -all`,
          `Verify: dig +short TXT ${root}`,
        ],
      })
    }
  }

  // DMARC — TXT record at _dmarc.<domain>
  try {
    const txt = await dns.resolveTxt(`_dmarc.${root}`)
    const flat = txt.map((r) => r.join(''))
    const dmarc = flat.find((r) => /^v=DMARC1/i.test(r))
    if (!dmarc) {
      findings.push(noDmarcFinding(root))
    } else if (/p=none/i.test(dmarc)) {
      // DMARC exists but in monitor-only mode — still a finding (lower severity)
      findings.push({
        severity: 'medium',
        vendor: 'DNS',
        exposure_type: 'dmarc_p_none',
        port: 53,
        endpoint_path: `TXT _dmarc.${root}`,
        signature: dmarc,
        remediation_title: `DMARC policy is "p=none" — monitor-only, not enforcing`,
        remediation_steps: [
          `Your DMARC policy is in monitor mode (p=none) — emails that fail SPF/DKIM are still delivered.`,
          `Once you've reviewed reports for a few weeks and confirmed legitimate senders pass, escalate to p=quarantine.`,
          `Eventually move to p=reject for full protection.`,
          `New value: v=DMARC1; p=quarantine; rua=mailto:dmarc@${root}; pct=100`,
        ],
      })
    }
  } catch (e: any) {
    if (e.code === 'ENODATA' || e.code === 'ENOTFOUND') {
      findings.push(noDmarcFinding(root))
    }
  }

  // Subdomain takeover risk — CNAME chain to known-vulnerable cloud destinations
  // We check the original `domain` arg (which may be a subdomain).
  try {
    const cnames = await dns.resolveCname(domain).catch(() => [] as string[])
    for (const c of cnames) {
      const takeoverPattern = matchTakeoverRisk(c)
      if (takeoverPattern) {
        // Verify it's actually unclaimed by checking HTTP response
        try {
          const r = await fetch(`https://${c}`, { signal: AbortSignal.timeout(5000) })
          const body = await r.text().catch(() => '')
          if (takeoverPattern.bodyMatch && takeoverPattern.bodyMatch.test(body)) {
            findings.push({
              severity: 'high',
              vendor: 'DNS',
              exposure_type: 'subdomain_takeover_risk',
              port: 0,
              endpoint_path: `CNAME ${domain} → ${c}`,
              signature: `${takeoverPattern.service} CNAME with takeover signature: "${takeoverPattern.signature}"`,
              remediation_title: `Dangling CNAME on ${domain} — vulnerable to subdomain takeover`,
              remediation_steps: [
                `Your subdomain ${domain} has a CNAME to ${c} (${takeoverPattern.service}).`,
                `The destination resource is no longer claimed — anyone can register the same name in ${takeoverPattern.service} and serve content from your subdomain.`,
                `Either: re-create the resource at ${c} in your ${takeoverPattern.service} account.`,
                `Or: remove the CNAME from your DNS entirely.`,
                `Audit ALL your subdomain CNAMEs for similar dangling references.`,
              ],
            })
          }
        } catch { /* couldn't verify, skip */ }
      }
    }
  } catch { /* no CNAME = no risk */ }

  return findings
}

function noDmarcFinding(root: string): ProbeFinding {
  return {
    severity: 'high',
    vendor: 'DNS',
    exposure_type: 'missing_dmarc',
    port: 53,
    endpoint_path: `TXT _dmarc.${root}`,
    signature: `No DMARC record at _dmarc.${root}`,
    remediation_title: `No DMARC policy on ${root} — attackers can spoof your domain in email`,
    remediation_steps: [
      `In your DNS provider, add a TXT record at the host _dmarc (e.g. _dmarc.${root}).`,
      `Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@${root}; pct=100`,
      `Start with p=quarantine to monitor; promote to p=reject after a few weeks of clean reports.`,
      `Save and wait for DNS propagation.`,
      `Verify with: dig +short TXT _dmarc.${root}`,
    ],
  }
}

function stripWww(d: string) {
  return d.replace(/^www\./i, '')
}

// Common cloud providers where unclaimed CNAMEs lead to takeover.
// Body-match patterns are the response signature when the resource doesn't exist.
const TAKEOVER_FINGERPRINTS: Array<{
  service: string
  cnameMatch: RegExp
  signature: string
  bodyMatch: RegExp | null
}> = [
  { service: 'AWS S3', cnameMatch: /\.s3[.-].*amazonaws\.com$/i, signature: 'NoSuchBucket', bodyMatch: /NoSuchBucket/ },
  { service: 'GitHub Pages', cnameMatch: /\.github\.io$/i, signature: 'There isn\'t a GitHub Pages site here.', bodyMatch: /There isn't a GitHub Pages site here\./ },
  { service: 'Heroku', cnameMatch: /\.herokuapp\.com$/i, signature: 'No such app', bodyMatch: /no such app/i },
  { service: 'Azure', cnameMatch: /\.(azurewebsites|cloudapp|trafficmanager)\.net$/i, signature: '404 - Web app not found', bodyMatch: /404 Web Site not found/i },
  { service: 'Surge.sh', cnameMatch: /\.surge\.sh$/i, signature: 'project not found', bodyMatch: /project not found/i },
  { service: 'Tumblr', cnameMatch: /\.domains\.tumblr\.com$/i, signature: 'Whatever you were looking for doesn\'t currently exist', bodyMatch: /Whatever you were looking for/i },
  { service: 'Fastly', cnameMatch: /\.fastly\.net$/i, signature: 'Fastly error: unknown domain', bodyMatch: /Fastly error: unknown domain/i },
]

function matchTakeoverRisk(cname: string) {
  for (const fp of TAKEOVER_FINGERPRINTS) {
    if (fp.cnameMatch.test(cname)) return fp
  }
  return null
}
