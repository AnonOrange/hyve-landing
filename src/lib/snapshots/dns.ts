// src/lib/snapshots/dns.ts
//
// DoH (DNS-over-HTTPS) via Cloudflare 1.1.1.1 — works from Edge and Node.

export interface DnsSnapshot {
  hyveapp_a: string[] | null
  www_cname: string[] | null
  mx:        string[] | null
  dnssec:    boolean
  ts: number
}

interface DohResp { Status: number; AD?: boolean; Answer?: { data: string }[] }

async function doh(name: string, type: 'A' | 'CNAME' | 'MX'): Promise<DohResp> {
  const res = await fetch(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}&do=1`,
    { headers: { Accept: 'application/dns-json' }, signal: AbortSignal.timeout(5_000) },
  )
  return res.json()
}

export async function snapshotDns(): Promise<DnsSnapshot> {
  const [a, cname, mx] = await Promise.allSettled([
    doh('hyveapp.co', 'A'),
    doh('www.hyveapp.co', 'CNAME'),
    doh('hyveapp.co', 'MX'),
  ])

  const data = (r: PromiseSettledResult<DohResp>) =>
    r.status === 'fulfilled' ? (r.value.Answer?.map((x) => x.data) ?? null) : null
  const ad = (r: PromiseSettledResult<DohResp>) =>
    r.status === 'fulfilled' && r.value.AD === true

  return {
    hyveapp_a: data(a),
    www_cname: data(cname),
    mx: data(mx),
    dnssec: ad(a) || ad(cname) || ad(mx),
    ts: Date.now(),
  }
}
