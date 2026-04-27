import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin/get-session'
import { supaGet } from '@/lib/supabase'
import AdminShell from '../_shell'
import type { RevenueSnapshot } from '@/lib/snapshots/stripe-revenue'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Financial · HYVE Admin' }

function fmtUsd(cents: number) {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })
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

const PRODUCTS = ['messenger', 'spy', 'spy_pro', 'sentinel'] as const

export default async function FinancialPage() {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')

  const [snapsRes, purchasesRes, failedRes] = await Promise.all([
    supaGet('snapshots', 'key=in.(revenue,threat_level,last_cron)&select=key,payload'),
    supaGet('recent_purchases', 'select=id,ts,product,plan,amount,currency,hyve_id,customer_id&order=ts.desc&limit=50'),
    supaGet('failed_payments', 'select=id,ts,customer_id,amount,reason&order=ts.desc&limit=20'),
  ])

  const snaps = snapsRes.ok
    ? Object.fromEntries((await snapsRes.json() as { key: string; payload: unknown }[]).map(r => [r.key, r.payload]))
    : {}

  const revenue  = snaps.revenue as RevenueSnapshot | null
  const threat   = snaps.threat_level as { level: 'low'|'guarded'|'elevated'|'high'|'critical'; score: number; signals: Array<{ kind: string; severity: number }> } | null
  const lastCron = snaps.last_cron as { ts: number } | null

  const purchases = purchasesRes.ok ? await purchasesRes.json() as { id: number; ts: string; product: string; plan: string; amount: number; currency: string; hyve_id?: string; customer_id: string }[] : []
  const failed    = failedRes.ok    ? await failedRes.json()    as { id: number; ts: string; customer_id: string; amount: number; reason: string }[] : []

  return (
    <AdminShell session={session} threat={threat} lastScanTs={lastCron?.ts ?? null} activePath="/admin/financial">

      {/* ── Revenue summary ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 9, letterSpacing: '0.3em', color: '#444', marginBottom: 12 }}>REVENUE SUMMARY</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          {[{ label: 'MRR', value: revenue ? fmtUsd(revenue.total.mrr) : '—' },
            { label: 'REVENUE 30D', value: revenue ? fmtUsd(revenue.total.revenue30d) : '—' },
            { label: 'ACTIVE SUBS', value: revenue ? String(revenue.total.activeSubCount) : '—' }].map(s => (
            <div key={s.label} style={{ background: '#131313', border: '1px solid #1e1e1e', padding: '16px 20px', flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: 9, letterSpacing: '0.25em', color: '#555', marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#FFB800', fontFamily: 'monospace' }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Per-product table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e1e1e' }}>
              {['PRODUCT', 'MRR', 'REVENUE 30D', 'ACTIVE SUBS'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '7px 12px', fontSize: 9, letterSpacing: '0.2em', color: '#444', fontWeight: 400 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PRODUCTS.map(p => {
              const pr = revenue?.byProduct[p]
              const color = PRODUCT_COLOR[p]
              return (
                <tr key={p} style={{ borderBottom: '1px solid #111' }}>
                  <td style={{ padding: '9px 12px' }}>
                    <span style={{ color, fontSize: 9, letterSpacing: '0.15em' }}>{p.replace('_', ' ').toUpperCase()}</span>
                  </td>
                  <td style={{ padding: '9px 12px', color: '#e0e0e0', fontFamily: 'monospace' }}>{pr ? fmtUsd(pr.mrr) : '—'}</td>
                  <td style={{ padding: '9px 12px', color: '#e0e0e0', fontFamily: 'monospace' }}>{pr ? fmtUsd(pr.revenue30d) : '—'}</td>
                  <td style={{ padding: '9px 12px', color: '#888' }}>{pr ? pr.activeSubCount : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Recent purchases ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 9, letterSpacing: '0.3em', color: '#444', marginBottom: 12 }}>
          RECENT PURCHASES <span style={{ color: '#333' }}>({purchases.length})</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e1e1e' }}>
              {['TIME', 'PRODUCT', 'PLAN', 'AMOUNT', 'HYVE ID', 'CUSTOMER'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '6px 10px', fontSize: 9, letterSpacing: '0.2em', color: '#444', fontWeight: 400 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {purchases.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid #0f0f0f' }}>
                <td style={{ padding: '7px 10px', color: '#555' }}>{fmtTime(p.ts)}</td>
                <td style={{ padding: '7px 10px' }}>
                  <span style={{ color: PRODUCT_COLOR[p.product] ?? '#555', fontSize: 9, letterSpacing: '0.1em' }}>{p.product.toUpperCase()}</span>
                </td>
                <td style={{ padding: '7px 10px', color: '#888' }}>{p.plan}</td>
                <td style={{ padding: '7px 10px', color: '#e0e0e0', fontFamily: 'monospace' }}>{fmtUsd(p.amount)}</td>
                <td style={{ padding: '7px 10px', color: '#555' }}>{p.hyve_id ?? '—'}</td>
                <td style={{ padding: '7px 10px', color: '#444', fontSize: 10 }}>{p.customer_id.slice(0, 14)}…</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Failed payments ── */}
      {failed.length > 0 && (
        <div>
          <div style={{ fontSize: 9, letterSpacing: '0.3em', color: '#ff5555', marginBottom: 12 }}>
            FAILED PAYMENTS <span style={{ color: '#5a1a1a' }}>({failed.length})</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2a1a1a' }}>
                {['TIME', 'AMOUNT', 'REASON', 'CUSTOMER'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 10px', fontSize: 9, letterSpacing: '0.2em', color: '#5a2a2a', fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {failed.map(f => (
                <tr key={f.id} style={{ borderBottom: '1px solid #1a0f0f' }}>
                  <td style={{ padding: '7px 10px', color: '#555' }}>{fmtTime(f.ts)}</td>
                  <td style={{ padding: '7px 10px', color: '#e0e0e0', fontFamily: 'monospace' }}>{fmtUsd(f.amount)}</td>
                  <td style={{ padding: '7px 10px', color: '#ff5555', fontSize: 10 }}>{f.reason}</td>
                  <td style={{ padding: '7px 10px', color: '#444', fontSize: 10 }}>{f.customer_id.slice(0, 14)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  )
}
