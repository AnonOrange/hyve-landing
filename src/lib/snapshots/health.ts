// src/lib/snapshots/health.ts

export interface ServiceHealth {
  up: boolean
  latencyMs: number | null
}

export interface HealthSnapshot {
  relay:  ServiceHealth
  hyveId: ServiceHealth
  vercel: ServiceHealth
  stripe: ServiceHealth
  ts: number
}

async function checkUrl(url: string): Promise<ServiceHealth> {
  const t0 = Date.now()
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) })
    return { up: res.ok, latencyMs: Date.now() - t0 }
  } catch {
    return { up: false, latencyMs: null }
  }
}

export async function snapshotHealth(): Promise<HealthSnapshot> {
  const [relay, hyveId, vercel, stripe] = await Promise.all([
    checkUrl('https://hyve-relay-production.up.railway.app/health'),
    checkUrl('https://hyve-id-production.up.railway.app/health'),
    checkUrl('https://www.hyveapp.co/'),
    // Stripe 401 still means it's reachable
    checkUrl('https://api.stripe.com/v1/charges?limit=1').then((r) => ({ ...r, up: r.latencyMs !== null })),
  ])
  return { relay, hyveId, vercel, stripe, ts: Date.now() }
}
