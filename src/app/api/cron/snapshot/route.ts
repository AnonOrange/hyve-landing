import { NextRequest, NextResponse } from 'next/server'
import { snapshotHealth } from '@/lib/snapshots/health'
import { snapshotTls } from '@/lib/snapshots/tls'
import { snapshotDns } from '@/lib/snapshots/dns'
import { snapshotApkDownloads } from '@/lib/snapshots/github'
import { snapshotStripeRevenue } from '@/lib/snapshots/stripe-revenue'
import { computeThreatLevel, SEVERITY, type ThreatSignal } from '@/lib/snapshots/threat-level'
import { supaPost, supaPatch, supaGet } from '@/lib/supabase'
import { kv } from '@/lib/kv'

// Cron runs on Node runtime (needs node:tls for TLS check)
export const runtime = 'nodejs'
export const maxDuration = 60

const CRON_SECRET = process.env.CRON_SECRET

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))])
}

async function upsertSnapshot(key: string, payload: unknown): Promise<void> {
  // Try PATCH first, fall back to INSERT
  const res = await supaPatch('snapshots', `key=eq.${encodeURIComponent(key)}`, { payload, ts: new Date().toISOString() })
  if (res.status === 404 || res.status === 406) {
    // No existing row — insert
    await supaPost('snapshots', { key, payload, ts: new Date().toISOString() }, 'return=minimal')
  }
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('Authorization')
  const got = auth?.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!CRON_SECRET || got !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [healthResult, tlsResult, dnsResult, apkResult, revenueResult, hyveIdResult, sentinelResult] =
    await Promise.allSettled([
      withTimeout(snapshotHealth(), 10_000),
      withTimeout(snapshotTls(), 10_000),
      withTimeout(snapshotDns(), 10_000),
      withTimeout(snapshotApkDownloads(), 10_000),
      withTimeout(snapshotStripeRevenue(), 10_000),
      withTimeout(fetchHyveIdStats(), 10_000),
      withTimeout(fetchSentinelStats(), 10_000),
    ])

  const writes: Promise<void>[] = []
  const errors: string[] = []

  if (healthResult.status === 'fulfilled') {
    writes.push(upsertSnapshot('health', healthResult.value))
  } else {
    errors.push(`health: ${healthResult.reason}`)
  }

  if (tlsResult.status === 'fulfilled') {
    writes.push(upsertSnapshot('tls', tlsResult.value))
  } else {
    errors.push(`tls: ${tlsResult.reason}`)
  }

  if (dnsResult.status === 'fulfilled') {
    writes.push(upsertSnapshot('dns', dnsResult.value))
  } else {
    errors.push(`dns: ${dnsResult.reason}`)
  }

  if (apkResult.status === 'fulfilled') {
    writes.push(upsertSnapshot('apk', apkResult.value))
  } else {
    errors.push(`apk: ${apkResult.reason}`)
  }

  if (revenueResult.status === 'fulfilled') {
    writes.push(upsertSnapshot('revenue', revenueResult.value))
  } else {
    errors.push(`revenue: ${revenueResult.reason}`)
  }

  if (hyveIdResult.status === 'fulfilled') {
    writes.push(upsertSnapshot('users', hyveIdResult.value))
  } else {
    errors.push(`hyveId: ${hyveIdResult.reason}`)
  }

  if (sentinelResult.status === 'fulfilled') {
    writes.push(upsertSnapshot('sentinel', sentinelResult.value))
  } else {
    errors.push(`sentinel: ${sentinelResult.reason}`)
  }

  // Compute threat level from available signals
  const signals: ThreatSignal[] = buildThreatSignals({ tlsResult, healthResult, dnsResult })
  const threat = computeThreatLevel(signals)
  writes.push(upsertSnapshot('threat_level', threat))
  writes.push(upsertSnapshot('last_cron', { ts: Date.now() }))

  await Promise.allSettled(writes)

  // Mark brute-force signal in KV if any login lockouts are active
  // (checked asynchronously — no need to block the response)
  void checkBruteForce()

  return NextResponse.json({ ok: true, errors: errors.length ? errors : undefined })
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function fetchHyveIdStats(): Promise<{ userCount: number; ts: number }> {
  const res = await fetch('https://hyve-id-production.up.railway.app/v1/stats', {
    signal: AbortSignal.timeout(8_000),
  })
  if (!res.ok) throw new Error(`hyve-id /v1/stats returned ${res.status}`)
  const data = await res.json() as { users: number }
  return { userCount: data.users, ts: Date.now() }
}

async function fetchSentinelStats(): Promise<{ auditCount: number; ts: number }> {
  const res = await supaGet('sentinel_audits', 'select=count')
  if (!res.ok) throw new Error(`sentinel_audits count failed: ${res.status}`)
  const rows = await res.json() as { count: string }[]
  return { auditCount: parseInt(rows[0]?.count ?? '0', 10), ts: Date.now() }
}

function buildThreatSignals(results: {
  tlsResult: PromiseSettledResult<Awaited<ReturnType<typeof snapshotTls>>>
  healthResult: PromiseSettledResult<Awaited<ReturnType<typeof snapshotHealth>>>
  dnsResult: PromiseSettledResult<Awaited<ReturnType<typeof snapshotDns>>>
}): ThreatSignal[] {
  const signals: ThreatSignal[] = []

  if (results.tlsResult.status === 'fulfilled') {
    const tls = results.tlsResult.value.hyveapp
    if ('daysLeft' in tls) {
      if (tls.daysLeft <= 7)  signals.push({ kind: 'tls_expiring_7d',  severity: SEVERITY.tls_expiring_7d })
      else if (tls.daysLeft <= 14) signals.push({ kind: 'tls_expiring_14d', severity: SEVERITY.tls_expiring_14d })
      else if (tls.daysLeft <= 30) signals.push({ kind: 'tls_expiring_30d', severity: SEVERITY.tls_expiring_30d })
    }
  }

  if (results.healthResult.status === 'fulfilled') {
    const h = results.healthResult.value
    if (!h.relay.up || !h.hyveId.up) {
      signals.push({ kind: 'server_health_failed', severity: SEVERITY.server_health_failed })
    }
    if (!h.stripe.up) {
      signals.push({ kind: 'stripe_unreachable', severity: SEVERITY.stripe_unreachable })
    }
  }

  if (results.dnsResult.status === 'fulfilled') {
    if (!results.dnsResult.value.dnssec) {
      signals.push({ kind: 'dnssec_disabled', severity: SEVERITY.dnssec_disabled })
    }
  }

  return signals
}

async function checkBruteForce(): Promise<void> {
  // If any login_fail:* keys exist in KV, brute_force signal should be raised.
  // We can't enumerate KV keys, so instead we write the threat level with
  // a brute_force signal only when the cron detects lockout events in audit log.
  try {
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString()
    const res = await supaGet(
      'admin_audit_log',
      `action=eq.login_fail&ts=gte.${encodeURIComponent(since)}&select=id&limit=1`,
    )
    if (res.ok) {
      const rows = await res.json() as unknown[]
      if (rows.length > 0) {
        await kv.set('brute_force_active', '1', { ex: 15 * 60 })
      }
    }
  } catch {
    // Non-critical
  }
}
