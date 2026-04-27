import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin/get-session'
import { supaGet } from '@/lib/supabase'
import AdminShell from '../_shell'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Traffic · HYVE Admin' }

type TrafficRow = { ts: string; vid_hash: string; product: string | null; event: string | null; source: string; country: string | null }

const PRODUCT_COLOR: Record<string, string> = {
  messenger: '#FFB800',
  spy:       '#00cfff',
  sentinel:  '#39FF14',
  home:      '#888',
}

function countBy<T>(arr: T[], key: (t: T) => string): [string, number][] {
  const map: Record<string, number> = {}
  for (const t of arr) {
    const k = key(t)
    map[k] = (map[k] ?? 0) + 1
  }
  return Object.entries(map).sort((a, b) => b[1] - a[1])
}

function fmtPct(n: number, d: number) {
  if (d === 0) return '—'
  return Math.round((n / d) * 100) + '%'
}

export default async function TrafficPage() {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')

  const cutoff30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const cutoff7d  = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000).toISOString()

  const [snapsRes, eventsRes] = await Promise.all([
    supaGet('snapshots', 'key=in.(threat_level,last_cron,apk)&select=key,payload'),
    supaGet('traffic_events', `ts=gte.${encodeURIComponent(cutoff30d)}&select=ts,vid_hash,product,event,source,country&limit=10000&order=ts.asc`),
  ])

  const snaps = snapsRes.ok
    ? Object.fromEntries((await snapsRes.json() as { key: string; payload: unknown }[]).map(r => [r.key, r.payload]))
    : {}

  const threat   = snaps.threat_level as { level: 'low'|'guarded'|'elevated'|'high'|'critical'; score: number; signals: Array<{ kind: string; severity: number }> } | null
  const lastCron = snaps.last_cron as { ts: number } | null
  const apk      = snaps.apk as { downloadCount?: number } | null

  const events: TrafficRow[] = eventsRes.ok ? await eventsRes.json() : []
  const events7d = events.filter(e => e.ts >= cutoff7d)

  // Daily unique visitors (30d)
  const byDay: Record<string, Set<string>> = {}
  for (const e of events) {
    const day = e.ts.slice(0, 10)
    if (!byDay[day]) byDay[day] = new Set()
    byDay[day].add(e.vid_hash)
  }
  const dailyVisitors = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, vids]) => ({ day, count: vids.size }))

  // Total uniques 30d
  const uniques30d = new Set(events.map(e => e.vid_hash)).size
  const uniques7d  = new Set(events7d.map(e => e.vid_hash)).size

  // Funnel per product
  const FUNNEL_PRODUCTS = ['messenger', 'spy', 'sentinel'] as const
  const funnel = Object.fromEntries(FUNNEL_PRODUCTS.map(p => {
    const pEvents = events.filter(e => e.product === p)
    const pageviews    = new Set(pEvents.filter(e => !e.event || e.event === 'pageview').map(e => e.vid_hash)).size
    const pricingViews = new Set(pEvents.filter(e => e.event === 'pricing_view').map(e => e.vid_hash)).size
    const checkoutOpen = new Set(pEvents.filter(e => e.event === 'checkout_open').map(e => e.vid_hash)).size
    return [p, { pageviews, pricingViews, checkoutOpen }]
  }))

  // Top sources & countries (7d)
  const topSources   = countBy(events7d, e => e.source).slice(0, 10)
  const topCountries = countBy(events7d.filter(e => e.country), e => e.country!).slice(0, 10)

  // Build sparkline SVG
  const MAX_V = Math.max(...dailyVisitors.map(d => d.count), 1)
  const W = 600; const H = 48
  const points = dailyVisitors.map((d, i) => {
    const x = (i / Math.max(dailyVisitors.length - 1, 1)) * W
    const y = H - (d.count / MAX_V) * H
    return `${x},${y}`
  }).join(' ')

  return (
    <AdminShell session={session} threat={threat} lastScanTs={lastCron?.ts ?? null} activePath="/admin/traffic">

      {/* ── Summary stats ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
        {[
          { label: 'UNIQUE VISITORS 30D', value: String(uniques30d) },
          { label: 'UNIQUE VISITORS 7D',  value: String(uniques7d) },
          { label: 'APK DOWNLOADS',       value: apk?.downloadCount != null ? String(apk.downloadCount) : '—' },
          { label: 'TOTAL EVENTS 30D',    value: String(events.length) },
        ].map(s => (
          <div key={s.label} style={{ background: '#131313', border: '1px solid #1e1e1e', padding: '16px 20px', flex: 1, minWidth: 140 }}>
            <div style={{ fontSize: 9, letterSpacing: '0.25em', color: '#555', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#FFB800', fontFamily: 'monospace' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── Sparkline ── */}
      {dailyVisitors.length > 1 && (
        <div style={{ background: '#131313', border: '1px solid #1e1e1e', padding: '16px 20px', marginBottom: 28 }}>
          <div style={{ fontSize: 9, letterSpacing: '0.25em', color: '#444', marginBottom: 10 }}>DAILY UNIQUE VISITORS (30D)</div>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 48, display: 'block' }}>
            <polyline points={points} fill="none" stroke="#FFB800" strokeWidth="1.5" opacity="0.8" />
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#333', marginTop: 4 }}>
            <span>{dailyVisitors[0]?.day}</span>
            <span>{dailyVisitors[dailyVisitors.length - 1]?.day}</span>
          </div>
        </div>
      )}

      {/* ── Product funnels ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 9, letterSpacing: '0.3em', color: '#444', marginBottom: 12 }}>CONVERSION FUNNEL (30D)</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {FUNNEL_PRODUCTS.map(p => {
            const f = funnel[p] as { pageviews: number; pricingViews: number; checkoutOpen: number }
            const color = PRODUCT_COLOR[p] ?? '#888'
            return (
              <div key={p} style={{ background: '#131313', border: '1px solid #1e1e1e', borderLeft: `3px solid ${color}`, padding: '14px 18px', flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 9, letterSpacing: '0.2em', color, marginBottom: 10 }}>{p.toUpperCase()}</div>
                <div style={{ fontSize: 11, lineHeight: 2, color: '#888' }}>
                  <div>Pageviews <span style={{ color: '#e0e0e0', float: 'right', fontFamily: 'monospace' }}>{f.pageviews}</span></div>
                  <div>Pricing views <span style={{ color: '#e0e0e0', float: 'right', fontFamily: 'monospace' }}>{f.pricingViews} <span style={{ color: '#444', fontSize: 9 }}>{fmtPct(f.pricingViews, f.pageviews)}</span></span></div>
                  <div>Checkout open <span style={{ color: '#e0e0e0', float: 'right', fontFamily: 'monospace' }}>{f.checkoutOpen} <span style={{ color: '#444', fontSize: 9 }}>{fmtPct(f.checkoutOpen, f.pageviews)}</span></span></div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Sources + Countries (7d) ── */}
      <div style={{ display: 'flex', gap: 24 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, letterSpacing: '0.3em', color: '#444', marginBottom: 12 }}>TOP SOURCES (7D)</div>
          {topSources.map(([src, cnt]) => (
            <div key={src} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #111', fontSize: 11 }}>
              <span style={{ color: '#888' }}>{src}</span>
              <span style={{ color: '#e0e0e0', fontFamily: 'monospace' }}>{cnt}</span>
            </div>
          ))}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, letterSpacing: '0.3em', color: '#444', marginBottom: 12 }}>TOP COUNTRIES (7D)</div>
          {topCountries.map(([cc, cnt]) => (
            <div key={cc} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #111', fontSize: 11 }}>
              <span style={{ color: '#888' }}>{cc}</span>
              <span style={{ color: '#e0e0e0', fontFamily: 'monospace' }}>{cnt}</span>
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  )
}
