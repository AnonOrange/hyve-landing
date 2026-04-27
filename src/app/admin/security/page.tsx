import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin/get-session'
import { supaGet } from '@/lib/supabase'
import AdminShell from '../_shell'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Security · HYVE Admin' }

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const ACTION_COLOR: Record<string, string> = {
  sign_in: '#39FF14', sign_out: '#555', invite: '#FFB800', invite_accepted: '#39FF14',
  revoke: '#ff5555', role_change: '#a855f7', login_fail: '#ff5555',
  reset_requested: '#FFB800', password_reset: '#FFB800', scan: '#00cfff',
}

type ThreatLevel = 'low' | 'guarded' | 'elevated' | 'high' | 'critical'

const THREAT_COLOR: Record<ThreatLevel, string> = {
  low: '#39FF14', guarded: '#39FF14', elevated: '#FFB800', high: '#ff8800', critical: '#ff5555',
}

function StatusDot({ ok }: { ok: boolean }) {
  return <span style={{ color: ok ? '#39FF14' : '#ff5555', fontSize: 8, marginRight: 6 }}>●</span>
}

export default async function SecurityPage() {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')

  const cutoff15m = new Date(Date.now() - 15 * 60 * 1000).toISOString()

  const [snapsRes, auditRes, loginFailRes] = await Promise.all([
    supaGet('snapshots', 'key=in.(tls,dns,health,brute_force,threat_level,last_cron)&select=key,payload'),
    supaGet('admin_audit_log', 'select=id,ts,actor_email,action,target_email,detail,ip&order=ts.desc&limit=100'),
    supaGet('admin_audit_log', `action=eq.login_fail&ts=gte.${encodeURIComponent(cutoff15m)}&select=id,ts,ip&order=ts.desc&limit=20`),
  ])

  const snaps = snapsRes.ok
    ? Object.fromEntries((await snapsRes.json() as { key: string; payload: unknown }[]).map(r => [r.key, r.payload]))
    : {}

  const threat      = snaps.threat_level as { level: ThreatLevel; score: number; signals: Array<{ kind: string; severity: number }> } | null
  const lastCron    = snaps.last_cron   as { ts: number } | null
  const tls         = snaps.tls         as { hyveapp?: { valid?: boolean; daysLeft?: number; issuer?: string } | { error?: string } } | null
  const dns         = snaps.dns         as { a?: string[]; dnssec?: boolean; mx?: string[] } | null
  const health      = snaps.health      as { relay?: { up: boolean; latencyMs?: number }; hyveId?: { up: boolean; latencyMs?: number }; vercel?: { up: boolean; latencyMs?: number }; stripe?: { up: boolean; latencyMs?: number } } | null
  const bruteForce  = snaps.brute_force as { active?: boolean; count?: number } | null

  const auditLog   = auditRes.ok      ? await auditRes.json()      as { id: number; ts: string; actor_email: string; action: string; target_email?: string; detail?: string; ip?: string }[] : []
  const loginFails = loginFailRes.ok  ? await loginFailRes.json()  as { id: number; ts: string; ip?: string }[] : []

  const tlsData = tls?.hyveapp as ({ valid?: boolean; daysLeft?: number; issuer?: string } & { error?: string }) | null | undefined
  const tlsOk   = tlsData && !tlsData.error && tlsData.valid !== false

  return (
    <AdminShell session={session} threat={threat} lastScanTs={lastCron?.ts ?? null} activePath="/admin/security">

      {/* ── Threat level detail ── */}
      <div style={{ background: '#131313', border: '1px solid #1e1e1e', padding: '18px 20px', marginBottom: 24 }}>
        <div style={{ fontSize: 9, letterSpacing: '0.3em', color: '#444', marginBottom: 12 }}>THREAT LEVEL</div>
        {threat ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ color: THREAT_COLOR[threat.level], fontSize: 8 }}>●</span>
              <span style={{ color: THREAT_COLOR[threat.level], fontSize: 18, fontWeight: 700, letterSpacing: '0.2em' }}>{threat.level.toUpperCase()}</span>
              <span style={{ color: '#444', fontSize: 11 }}>score {threat.score}</span>
            </div>
            {threat.signals.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {threat.signals.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                    <span style={{ color: '#ff5555', fontSize: 8 }}>▲</span>
                    <span style={{ color: '#e0e0e0' }}>{s.kind.replace(/_/g, ' ')}</span>
                    <span style={{ color: '#444' }}>severity {s.severity}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#39FF14', fontSize: 11 }}>No active signals</div>
            )}
          </>
        ) : (
          <div style={{ color: '#444', fontSize: 11 }}>No snapshot yet — run a scan.</div>
        )}
      </div>

      {/* ── Site command center ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 9, letterSpacing: '0.3em', color: '#444', marginBottom: 12 }}>SITE COMMAND CENTER</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <tbody>
            {/* TLS */}
            <tr style={{ borderBottom: '1px solid #111' }}>
              <td style={{ padding: '10px 12px', color: '#555', width: 160, fontSize: 10 }}>TLS CERT</td>
              <td style={{ padding: '10px 12px' }}>
                <StatusDot ok={!!tlsOk} />
                {tlsData && !tlsData.error
                  ? <span style={{ color: '#e0e0e0' }}>{tlsData.daysLeft} days left <span style={{ color: '#444' }}>({tlsData.issuer})</span></span>
                  : <span style={{ color: '#ff5555' }}>{(tlsData as { error?: string })?.error ?? 'No data'}</span>
                }
              </td>
            </tr>

            {/* DNS */}
            <tr style={{ borderBottom: '1px solid #111' }}>
              <td style={{ padding: '10px 12px', color: '#555', fontSize: 10 }}>DNSSEC</td>
              <td style={{ padding: '10px 12px' }}>
                <StatusDot ok={!!dns?.dnssec} />
                <span style={{ color: dns?.dnssec ? '#39FF14' : '#ff5555' }}>{dns ? (dns.dnssec ? 'enabled' : 'disabled') : '—'}</span>
              </td>
            </tr>

            {/* DNS A */}
            <tr style={{ borderBottom: '1px solid #111' }}>
              <td style={{ padding: '10px 12px', color: '#555', fontSize: 10 }}>DNS A</td>
              <td style={{ padding: '10px 12px', color: '#888', fontSize: 10 }}>{dns?.a?.join(', ') ?? '—'}</td>
            </tr>

            {/* Services */}
            {([
              ['hyve-relay',  health?.relay?.up,   health?.relay?.latencyMs],
              ['hyve-id',     health?.hyveId?.up,  health?.hyveId?.latencyMs],
              ['vercel',      health?.vercel?.up,  health?.vercel?.latencyMs],
              ['stripe',      health?.stripe?.up,  health?.stripe?.latencyMs],
            ] as [string, boolean | undefined, number | undefined][]).map(([name, up, ms]) => (
              <tr key={name} style={{ borderBottom: '1px solid #111' }}>
                <td style={{ padding: '10px 12px', color: '#555', fontSize: 10 }}>{name.toUpperCase()}</td>
                <td style={{ padding: '10px 12px' }}>
                  <StatusDot ok={!!up} />
                  <span style={{ color: up ? '#39FF14' : '#ff5555' }}>{up === undefined ? '—' : up ? 'UP' : 'DOWN'}</span>
                  {ms !== undefined && <span style={{ color: '#444', marginLeft: 8 }}>{ms}ms</span>}
                </td>
              </tr>
            ))}

            {/* Brute-force */}
            <tr style={{ borderBottom: '1px solid #111' }}>
              <td style={{ padding: '10px 12px', color: '#555', fontSize: 10 }}>BRUTE FORCE</td>
              <td style={{ padding: '10px 12px' }}>
                <StatusDot ok={!bruteForce?.active} />
                {bruteForce
                  ? <span style={{ color: bruteForce.active ? '#ff5555' : '#39FF14' }}>{bruteForce.active ? `active (${bruteForce.count} recent fail${bruteForce.count !== 1 ? 's' : ''})` : 'none detected'}</span>
                  : <span style={{ color: '#444' }}>—</span>
                }
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Recent login failures ── */}
      {loginFails.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 9, letterSpacing: '0.3em', color: '#ff5555', marginBottom: 12 }}>
            LOGIN FAILURES (LAST 15 MIN) — {loginFails.length}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {loginFails.map(f => (
              <div key={f.id} style={{ background: '#1a0808', border: '1px solid #3a1515', padding: '5px 10px', fontSize: 10, color: '#ff5555', fontFamily: 'monospace' }}>
                {f.ip ?? 'unknown'} <span style={{ color: '#444' }}>at {fmtTime(f.ts)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Audit log ── */}
      <div>
        <div style={{ fontSize: 9, letterSpacing: '0.3em', color: '#444', marginBottom: 12 }}>AUDIT LOG (LAST 100)</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e1e1e' }}>
              {['TIME', 'ACTOR', 'ACTION', 'TARGET', 'IP'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '5px 8px', fontSize: 8, letterSpacing: '0.2em', color: '#333', fontWeight: 400 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {auditLog.map(entry => (
              <tr key={entry.id} style={{ borderBottom: '1px solid #0d0d0d' }}>
                <td style={{ padding: '6px 8px', color: '#444', fontSize: 9, whiteSpace: 'nowrap' }}>{fmtTime(entry.ts)}</td>
                <td style={{ padding: '6px 8px', color: '#666' }}>{entry.actor_email}</td>
                <td style={{ padding: '6px 8px' }}>
                  <span style={{ color: ACTION_COLOR[entry.action] ?? '#888', letterSpacing: '0.1em' }}>{entry.action}</span>
                  {entry.detail && <span style={{ color: '#333', marginLeft: 6 }}>{entry.detail}</span>}
                </td>
                <td style={{ padding: '6px 8px', color: '#555' }}>{entry.target_email ?? '—'}</td>
                <td style={{ padding: '6px 8px', color: '#333', fontSize: 9 }}>{entry.ip ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  )
}
