// Hyve Sentinel scope-enforcement guard. Blocks asset registration for any
// target that is obviously-not-the-user's: government infrastructure, IANA-
// reserved address space, well-known cloud control planes, etc.
//
// This is REAL enforcement — not just a contractual attestation. Even with a
// signed authorization, the orchestrator refuses to scan these targets.
//
// Failure modes intentionally left in:
//   - User can still register their genuinely-owned domain that happens to
//     end in .gov (e.g. a state contractor with .gov subdomain) by contacting
//     support — we don't ship a self-service override for the obvious-bad list.

const TLD_BLOCKLIST = new Set([
  'gov', 'mil', // US federal
  'gov.uk', 'mod.uk', // UK
  'gov.au', 'gov.ca',
  'gc.ca', 'canada.ca',
])

const DOMAIN_BLOCKLIST = new Set([
  // Cloud control planes
  'aws.amazon.com', 'console.aws.amazon.com', 'signin.aws.amazon.com',
  'console.cloud.google.com', 'cloud.google.com', 'accounts.google.com',
  'portal.azure.com', 'login.microsoftonline.com',
  'manage.cloudflare.com', 'dash.cloudflare.com', 'cloudflare.com',
  'app.netlify.com', 'vercel.com',
  'console.firebase.google.com',
  'admin.shopify.com',
  // Major SaaS where scanning would just hit shared infra
  'github.com', 'gitlab.com', 'bitbucket.org',
  'stripe.com', 'connect.stripe.com', 'dashboard.stripe.com',
  'twilio.com', 'sendgrid.com', 'mailgun.com',
  // Auth providers
  'auth0.com', 'okta.com', 'duo.com',
  // Banking / financial common-targets
  'chase.com', 'bankofamerica.com', 'wellsfargo.com', 'citi.com',
  'paypal.com', 'venmo.com', 'cashapp.com',
  // High-value targets that are never user-owned
  'whitehouse.gov', 'fbi.gov', 'cia.gov', 'irs.gov',
  'apple.com', 'icloud.com',
  'microsoft.com', 'live.com', 'office.com',
  'google.com', 'youtube.com',
  'amazon.com',
  'facebook.com', 'instagram.com', 'whatsapp.com', 'meta.com',
  'twitter.com', 'x.com',
  'tiktok.com', 'bytedance.com',
])

/**
 * Returns null if the target is allowed. Returns a denial reason string if
 * blocked. Used by the asset-registration API to refuse obviously-bad scope.
 */
export function checkScopeAllowed(assetType: string, identifier: string): string | null {
  const id = identifier.toLowerCase().trim()

  if (assetType === 'domain') {
    return checkDomainAllowed(id)
  }
  if (assetType === 'ip') {
    return checkIpAllowed(id)
  }
  if (assetType === 'cidr') {
    return checkCidrAllowed(id)
  }
  // camera_serial type can't be checked (no network identifier — just text)
  // but the user signed authorization for it, that's the legal record
  return null
}

function checkDomainAllowed(domain: string): string | null {
  // Strip protocol + path if user pasted a URL
  const clean = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '')

  // Exact-match deny
  if (DOMAIN_BLOCKLIST.has(clean)) {
    return `${clean} is on the orchestrator blocklist (well-known third-party infrastructure). If you genuinely operate this domain, email support@hyveapp.co with proof of ownership.`
  }
  // Sub-of deny (e.g. login.aws.amazon.com matches aws.amazon.com)
  for (const blocked of DOMAIN_BLOCKLIST) {
    if (clean.endsWith('.' + blocked)) {
      return `${clean} is a subdomain of ${blocked} (blocklisted infrastructure). Contact support if you operate this asset.`
    }
  }

  // TLD deny (.gov, .mil, etc.)
  const parts = clean.split('.')
  for (let i = 1; i <= Math.min(parts.length - 1, 2); i++) {
    const suffix = parts.slice(parts.length - i - 1).join('.')
    if (TLD_BLOCKLIST.has(suffix)) {
      return `${clean} ends in .${suffix} (government / military TLD). These require manual authorization review — email support@hyveapp.co with documentation.`
    }
  }

  return null
}

function checkIpAllowed(ip: string): string | null {
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
    return `${ip} is not a valid IPv4 address.`
  }
  const octets = ip.split('.').map(Number)

  // IANA-reserved private + special address spaces
  if (octets[0] === 10) return `${ip} is in the private 10.0.0.0/8 range — won't be reachable from our scanner anyway.`
  if (octets[0] === 127) return `${ip} is in the loopback 127.0.0.0/8 range — not scannable.`
  if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return `${ip} is in the private 172.16.0.0/12 range.`
  if (octets[0] === 192 && octets[1] === 168) return `${ip} is in the private 192.168.0.0/16 range — won't be reachable.`
  if (octets[0] === 169 && octets[1] === 254) return `${ip} is in the link-local 169.254.0.0/16 range.`
  if (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127) return `${ip} is in the carrier-grade NAT 100.64.0.0/10 range.`
  if (octets[0] === 0) return `${ip} is in the reserved 0.0.0.0/8 range.`
  if (octets[0] === 224) return `${ip} is in the multicast 224.0.0.0/4 range.`
  if (octets[0] >= 240) return `${ip} is in the reserved 240.0.0.0/4 range.`

  return null
}

function checkCidrAllowed(cidr: string): string | null {
  const m = cidr.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/)
  if (!m) return `${cidr} is not a valid IPv4 CIDR.`
  const [, ip, bitsStr] = m
  const bits = parseInt(bitsStr, 10)
  if (bits < 16 || bits > 32) {
    return `CIDR mask /${bits} too broad — must be /16 to /32 (max 65,536 addresses per asset).`
  }
  return checkIpAllowed(ip)
}
