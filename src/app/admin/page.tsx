import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin/get-session'
import { supaGet } from '@/lib/supabase'
import AdminShell from './_shell'
import type { RevenueSnapshot } from '@/lib/snapshots/stripe-revenue'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Overview · HYVE Admin' }

// ── helpers ──────────────────────────────────────────────────────────────────

async function getSnapshots(keys: string[]) {
  const res = await supaGet('snapshots', `key=in.(${keys.join(',')})&select=key,payload`)
  if (!res.ok) return {} as Record<string, unknown>
  const rows = await res.json() as { key: string; payload: unknown }[]
  return Object.fromEntries(rows.map(r => [r.key, r.payload]))
}

async function getVisitorsToday(): Promise<number> {
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const res = await supaGet('traffic_events', `ts=gte.${encodeURIComponent(todayStart.toISOString())}&select=vid_hash`)
  if (!res.ok) return 0
  const rows = await res.json() as { vid_hash: string }[]
  return new Set(rows.map(r => r.vid_hash)).size
}

async function getRecentPurchases() {
  const res = await supaGet('recent_purchases', 'select=id,ts,product,plan,amount,currency,hyve_id&order=ts.desc&limit=5')
  if (!res.ok) return []
  return res.json() as Promise<{ id: number; ts: string; product: string; plan: string; amount: number; currency: string; hyve_id?: string }[]>
}

// ── formatters ───────────────────────────────────────────────────────────────

function fmtUsd(cents: number) {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const PRODUCT_COLOR: Record<string, string> = {
  messenger: '#FFB800',
  spy:       '#00cfff',
  spy_pro:   '#a855f7',
  sentinel:  '#39FF14',
  unknown:   '#555',
}

// ── components ───────────────────────────────────────────────────────────────

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: '#131313', border: '1px solid #1e1e1e', padding: '18px 20px', flex: 1, minWidth: 160 }}>
      <div style={{ fontSize: 9, letterSpacing: '0.25em', color: '#555', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#FFB800', fontFamily: 'monospace' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#444', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function ServicePill({ label, up, ms }: { label: string; up: boolean; ms?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#131313', border: '1px solid #1e1e1e', padding: '6px 12px', fontSize: 10 }}>
      <span style={{ color: up ? '#39FF14' : '#ff5555', fontSize: 7 }}>●</span>
      <span style={{ color: '#888', letterSpacing: '0.15em' }}>{label}</span>
      {ms !== undefined && <span style={{ color: '#444' }}>{ms}ms</span>}
    </div>
  )
}

// ── page ─────────────────────────────────────────────────────────────────────

export default async function OverviewPage() {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')

  const [snaps, visitorsToday, purchases] = await Promise.all([
    getSnapshots(['revenue', 'users', 'health', 'threat_level', 'last_cron']),
    getVisitorsToday(),
    getRecentPurchases(),
  ])

  const revenue = snaps.revenue as RevenueSnapshot | null
  const health  = snaps.health  as { relay?: { up: boolean; latencyMs?: number }; hyveId?: { up: boolean; latencyMs?: number }; vercel?: { up: boolean; latencyMs?: number }; stripe?: { up: boolean; latencyMs?: number } } | null
  const threat  = snaps.threat_level as { level: 'low'|'guarded'|'elevated'|'high'|'critical'; score: number; signals: Array<{ kind: string; severity: number }> } | null
  const lastCron = snaps.last_cron as { ts: number } | null
  const users   = snaps.users as { userCount: number } | null

  const PRODUCTS: Array<{ key: 'messenger'|'spy'|'spy_pro'|'sentinel'; label: string }> = [
    { key: 'messenger', label: 'Messenger' },
    { key: 'spy',       label: 'Spy' },
    { key: 'spy_pro',   label: 'Spy Pro' },
    { key: 'sentinel',  label: 'Sentinel' },
  ]

  return (
    <AdminShell session={session} threat={threat} lastScanTs={lastCron?.ts ?? null} activePath="/admin">

      {/* ── Top stat row ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <Stat label="MRR" value={revenue ? fmtUsd(revenue.total.mrr) : '—'} sub="monthly recurring" />
        <Stat label="ACTIVE SUBS" value={revenue ? String(revenue.total.activeSubCount) : '—'} />
        <Stat label="REVENUE 30D" value={revenue ? fmtUsd(revenue.total.revenue30d) : '—'} />
        <Stat label="VISITORS TODAY" value={String(visitorsToday)} />
        <Stat label="HYVE USERS" value={users ? String(users.userCount) : '—'} sub="registered accounts" />
      </div>

      {/* ── Per-product breakdown ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 9, letterSpacing: '0.3em', color: '#444', marginBottom: 12 }}>PER PRODUCT</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {PRODUCTS.map(p => {
            const pr = revenue?.byProduct[p.key]
            const color = PRODUCT_COLOR[p.key]
            return (
              <div key={p.key} style={{ background: '#131313', border: `1px solid #1e1e1e`, borderLeft: `3px solid ${color}`, padding: '14px 18px', minWidth: 160, flex: 1 }}>
                <div style={{ fontSize: 9, letterSpacing: '0.2em', color, marginBottom: 8 }}>{p.label.toUpperCase()}</div>
                <div style={{ fontSize: 14, color: '#e0e0e0', marginBottom: 4 }}>{pr ? fmtUsd(pr.mrr) : '—'} <span style={{ fontSize: 9, color: '#444' }}>MRR</span></div>
                <div style={{ fontSize: 11, color: '#666' }}>{pr ? pr.activeSubCount : '—'} subs · {pr ? fmtUsd(pr.revenue30d) : '—'} 30d</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Services ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 9, letterSpacing: '0.3em', color: '#444', marginBottom: 12 }}>SERVICES</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <ServicePill label="RELAY"   up={health?.relay?.up   ?? false} ms={health?.relay?.latencyMs} />
          <ServicePill label="HYVE-ID" up={health?.hyveId?.up  ?? false} ms={health?.hyveId?.latencyMs} />
          <ServicePill label="VERCEL"  up={health?.vercel?.up  ?? false} ms={health?.vercel?.latencyMs} />
          <ServicePill label="STRIPE"  up={health?.stripe?.up  ?? false} ms={health?.stripe?.latencyMs} />
        </div>
      </div>

      {/* ── Recent purchases ── */}
      <div>
        <div style={{ fontSize: 9, letterSpacing: '0.3em', color: '#444', marginBottom: 12 }}>RECENT PURCHASES</div>
        {purchases.length === 0 ? (
          <div style={{ color: '#333', fontSize: 11 }}>No purchases yet.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e1e1e' }}>
                {['TIME', 'PRODUCT', 'PLAN', 'AMOUNT', 'HYVE ID'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 10px', fontSize: 9, letterSpacing: '0.2em', color: '#444', fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {purchases.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid #111' }}>
                  <td style={{ padding: '8px 10px', color: '#666' }}>{fmtTime(p.ts)}</td>
                  <td style={{ padding: '8px 10px' }}>
                    <span style={{ color: PRODUCT_COLOR[p.product] ?? '#555', fontSize: 9, letterSpacing: '0.15em' }}>{p.product.toUpperCase()}</span>
                  </td>
                  <td style={{ padding: '8px 10px', color: '#888' }}>{p.plan}</td>
                  <td style={{ padding: '8px 10px', color: '#e0e0e0', fontFamily: 'monospace' }}>{fmtUsd(p.amount)}</td>
                  <td style={{ padding: '8px 10px', color: '#555' }}>{p.hyve_id ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ marginTop: 12 }}>
          <a href="/admin/financial" style={{ fontSize: 10, color: '#444', textDecoration: 'none' }}>View all purchases →</a>
        </div>
      </div>
    </AdminShell>
  )
}
