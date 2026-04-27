// /admin/realtime — at-a-glance status of the realtime cache layer.
//
// Shows last-sync timestamp + row count for each source, color-coded by
// freshness. Red = stale > 5 min for hot sources / 30 min for cold;
// amber = warning; green = fresh.
//
// Server-rendered so it's always current — no client-side polling needed.

import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin/get-session'
import { supaGet } from '@/lib/supabase'
import AdminShell from '../_shell'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Realtime Cache · HYVE Admin' }

type SyncRow = {
  source: string
  last_synced: string
  row_count: number
  status: 'ok' | 'failed'
  error: string | null
}

const HOT_SOURCES = new Set(['cameras', 'feeds', 'crime'])
const COLD_SOURCES = new Set(['world_cameras', 'offenders', 'surveillance'])

const SOURCE_LABELS: Record<string, string> = {
  cameras: 'US Cameras',
  feeds: 'Scanner Feeds',
  crime: 'Crime Incidents',
  world_cameras: 'World Cameras',
  offenders: 'Sex Offender Registry',
  surveillance: 'Surveillance / ALPR',
}

function ageSeconds(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
}

function ageLabel(sec: number): string {
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`
  return `${Math.floor(sec / 86400)}d`
}

function freshness(source: string, sec: number, status: string): { color: string; label: string } {
  if (status !== 'ok') return { color: '#ff5555', label: 'FAILED' }
  const isHot = HOT_SOURCES.has(source)
  const greenMax = isHot ? 90 : 360       // hot = 90s, cold = 6 min
  const amberMax = isHot ? 300 : 1800     // hot = 5 min, cold = 30 min
  if (sec <= greenMax) return { color: '#22C55E', label: 'FRESH' }
  if (sec <= amberMax) return { color: '#F59E0B', label: 'WARNING' }
  return { color: '#EF4444', label: 'STALE' }
}

const CARD: React.CSSProperties = {
  background: '#0a0a0a',
  border: '1px solid #1a1a1a',
  borderRadius: 2,
  padding: '14px 16px',
}

export default async function RealtimePage() {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')

  const now = new Date().toISOString()
  const [snapsRes, syncRes] = await Promise.all([
    supaGet('snapshots', 'key=in.(threat_level,last_cron)&select=key,payload'),
    supaGet('live_sync_meta', 'select=source,last_synced,row_count,status,error&order=source.asc'),
  ])

  const snaps = snapsRes.ok
    ? Object.fromEntries((await snapsRes.json() as { key: string; payload: unknown }[]).map(r => [r.key, r.payload]))
    : {}
  const threat = snaps.threat_level as { level: 'low'|'guarded'|'elevated'|'high'|'critical'; score: number; signals: Array<{ kind: string; severity: number }> } | null
  const lastCron = snaps.last_cron as { ts: number } | null

  const syncRows: SyncRow[] = syncRes.ok ? await syncRes.json() : []
  // Order: hot sources first, then cold
  const sortedRows = [...syncRows].sort((a, b) => {
    const aHot = HOT_SOURCES.has(a.source) ? 0 : 1
    const bHot = HOT_SOURCES.has(b.source) ? 0 : 1
    if (aHot !== bHot) return aHot - bHot
    return a.source.localeCompare(b.source)
  })

  const totalRows = syncRows.reduce((sum, r) => sum + (r.row_count || 0), 0)

  // Worst freshness across all sources determines overall health
  let worstFreshness: { color: string; label: string } | null = null
  for (const r of syncRows) {
    const f = freshness(r.source, ageSeconds(r.last_synced), r.status)
    if (!worstFreshness || (f.label === 'FAILED' || f.label === 'STALE')) {
      if (!worstFreshness ||
          (worstFreshness.label === 'FRESH' && f.label !== 'FRESH') ||
          (worstFreshness.label === 'WARNING' && (f.label === 'STALE' || f.label === 'FAILED'))) {
        worstFreshness = f
      }
    }
  }

  return (
    <AdminShell session={session} threat={threat} lastScanTs={lastCron?.ts ?? null} activePath="/admin/realtime">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: '0.3em', color: '#888' }}>REALTIME CACHE</div>
          <div style={{ fontSize: 22, fontFamily: 'monospace', color: '#FFB800', marginTop: 4 }}>
            {totalRows.toLocaleString()} rows cached
          </div>
        </div>
        {worstFreshness && (
          <div style={{
            padding: '6px 14px',
            border: `1px solid ${worstFreshness.color}`,
            background: `${worstFreshness.color}15`,
            color: worstFreshness.color,
            fontSize: 10,
            letterSpacing: '0.2em',
            fontWeight: 700,
          }}>
            {worstFreshness.label}
          </div>
        )}
      </div>

      {/* Architecture explainer */}
      <div style={{ ...CARD, marginBottom: 20, fontSize: 11, color: '#aaa', lineHeight: 1.6 }}>
        <strong style={{ color: '#FFB800' }}>How this works:</strong> Railway worker
        (<code style={{ color: '#FFB800' }}>hyve-residential-worker</code>) pings{' '}
        <code style={{ color: '#FFB800' }}>/api/cron/realtime-sync</code> every 60s and
        <code style={{ color: '#FFB800' }}>/api/cron/realtime-sync-cold</code> every 5 min.
        Each call pulls fresh data from <code style={{ color: '#FFB800' }}>hyve-api.vercel.app</code>{' '}
        and upserts to the <code style={{ color: '#FFB800' }}>live_*</code> tables shown below.
        Spy-app pages read with geo filters via <code style={{ color: '#FFB800' }}>/api/realtime/*</code>.
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 100px 120px 120px 100px',
          padding: '6px 16px',
          fontSize: 9,
          letterSpacing: '0.2em',
          color: '#666',
          fontWeight: 700,
        }}>
          <div>SOURCE</div>
          <div style={{ textAlign: 'right' }}>ROWS</div>
          <div style={{ textAlign: 'right' }}>LAST SYNC</div>
          <div style={{ textAlign: 'right' }}>AGE</div>
          <div style={{ textAlign: 'right' }}>HEALTH</div>
        </div>
        {sortedRows.length === 0 && (
          <div style={{ ...CARD, textAlign: 'center', color: '#666' }}>
            No sync data yet — worker may not have run.
          </div>
        )}
        {sortedRows.map((r) => {
          const sec = ageSeconds(r.last_synced)
          const f = freshness(r.source, sec, r.status)
          const isHot = HOT_SOURCES.has(r.source)
          return (
            <div key={r.source} style={{
              ...CARD,
              display: 'grid',
              gridTemplateColumns: '1fr 100px 120px 120px 100px',
              alignItems: 'center',
              borderLeft: `3px solid ${f.color}`,
            }}>
              <div>
                <div style={{ color: '#e0e0e0', fontWeight: 600 }}>{SOURCE_LABELS[r.source] || r.source}</div>
                <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>
                  {isHot ? 'hot · 60s cadence' : 'cold · 5min cadence'} · {r.source}
                </div>
                {r.error && (
                  <div style={{ fontSize: 10, color: '#ff8888', marginTop: 4, fontFamily: 'monospace' }}>
                    ⚠ {r.error.slice(0, 100)}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right', fontFamily: 'monospace', color: '#aaa' }}>
                {(r.row_count || 0).toLocaleString()}
              </div>
              <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 10, color: '#888' }}>
                {new Date(r.last_synced).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <div style={{ textAlign: 'right', fontFamily: 'monospace', color: f.color, fontWeight: 700 }}>
                {ageLabel(sec)} ago
              </div>
              <div style={{
                textAlign: 'right',
                fontFamily: 'monospace',
                fontSize: 9,
                letterSpacing: '0.2em',
                color: f.color,
                fontWeight: 700,
              }}>
                {f.label}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 30, fontSize: 11, color: '#666' }}>
        <div style={{ fontSize: 9, letterSpacing: '0.3em', color: '#888', marginBottom: 8 }}>API ENDPOINTS</div>
        <div style={{ ...CARD, fontFamily: 'monospace', fontSize: 11, lineHeight: 1.8 }}>
          <div>
            <span style={{ color: '#FFB800' }}>GET</span> <code>/api/realtime/cameras?lat=&amp;lng=&amp;radius_mi=&amp;limit=</code>
          </div>
          <div>
            <span style={{ color: '#FFB800' }}>GET</span> <code>/api/realtime/feeds?lat=&amp;lng=&amp;radius_mi=&amp;limit=</code>
          </div>
          <div>
            <span style={{ color: '#FFB800' }}>GET</span> <code>/api/realtime/crime?lat=&amp;lng=&amp;radius_mi=&amp;since_hours=</code>
          </div>
          <div>
            <span style={{ color: '#FFB800' }}>GET</span> <code>/api/realtime/world-cams?lat=&amp;lng=&amp;radius_mi=</code>
          </div>
          <div>
            <span style={{ color: '#FFB800' }}>GET</span> <code>/api/realtime/offenders?lat=&amp;lng=&amp;radius_mi=&amp;state=</code>
          </div>
          <div>
            <span style={{ color: '#FFB800' }}>GET</span> <code>/api/realtime/surveillance?lat=&amp;lng=&amp;radius_mi=&amp;type=</code>
          </div>
        </div>
      </div>
    </AdminShell>
  )
}
