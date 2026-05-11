import type { AdminSession } from '@/lib/admin/session'
import SignOutButton from './_sign-out-button'
import ScanNowButton from './_scan-now-button'

const TABS = [
  { label: 'OVERVIEW',  href: '/admin' },
  { label: 'FINANCIAL', href: '/admin/financial' },
  { label: 'TRAFFIC',   href: '/admin/traffic' },
  { label: 'USERS',     href: '/admin/users' },
  { label: 'CASELINE',  href: '/admin/caseline-keys' },
  { label: 'REALTIME',  href: '/admin/realtime' },
  { label: 'SECURITY',  href: '/admin/security' },
]

type ThreatLevel = 'low' | 'guarded' | 'elevated' | 'high' | 'critical'

const THREAT_COLOR: Record<ThreatLevel, string> = {
  low:      '#39FF14',
  guarded:  '#39FF14',
  elevated: '#FFB800',
  high:     '#ff8800',
  critical: '#ff5555',
}

interface ThreatSnapshot {
  level: ThreatLevel
  score: number
  signals: Array<{ kind: string; severity: number }>
}

interface Props {
  session: AdminSession
  threat?: ThreatSnapshot | null
  lastScanTs?: number | null
  activePath: string
  children: React.ReactNode
}

export default function AdminShell({ session, threat, lastScanTs, activePath, children }: Props) {
  const level = (threat?.level ?? 'low') as ThreatLevel
  const color = THREAT_COLOR[level]
  const signalCount = threat?.signals?.length ?? 0
  const lastScanAgo = lastScanTs ? Math.round((Date.now() - lastScanTs) / 60_000) : null

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', color: '#d0d0d0', fontFamily: 'monospace' }}>

      {/* ── Header ── */}
      <header style={{ borderBottom: '1px solid #1e1e1e', padding: '10px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: '#FFB800', fontSize: 11, letterSpacing: '0.4em', fontWeight: 900 }}>
          HYVE · ADMIN
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11 }}>
          <span style={{ color: '#555' }}>{session.email}</span>
          <span style={{
            background: session.role === 'owner' ? '#FFB800' : '#222',
            color: session.role === 'owner' ? '#000' : '#888',
            padding: '2px 7px',
            fontSize: 9,
            letterSpacing: '0.25em',
            fontWeight: 900,
          }}>
            {session.role.toUpperCase()}
          </span>
          <SignOutButton />
        </div>
      </header>

      {/* ── Threat banner ── */}
      <div style={{ borderBottom: '1px solid #1e1e1e', padding: '7px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0d0d0d' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11 }}>
          <span style={{ color, fontSize: 7 }}>●</span>
          <span style={{ color, fontWeight: 700, letterSpacing: '0.2em' }}>THREAT: {level.toUpperCase()}</span>
          <span style={{ color: '#333' }}>·</span>
          <span style={{ color: '#555' }}>{signalCount} signal{signalCount !== 1 ? 's' : ''}</span>
          {lastScanAgo !== null && (
            <>
              <span style={{ color: '#333' }}>·</span>
              <span style={{ color: '#444' }}>scan {lastScanAgo}m ago</span>
            </>
          )}
        </div>
        <ScanNowButton />
      </div>

      {/* ── Tab nav ── */}
      <nav style={{ borderBottom: '1px solid #1e1e1e', padding: '0 24px', display: 'flex' }}>
        {TABS.map(tab => {
          const exact = tab.href === '/admin'
          const active = exact ? activePath === '/admin' : activePath.startsWith(tab.href)
          return (
            <a
              key={tab.href}
              href={tab.href}
              style={{
                display: 'block',
                padding: '11px 14px',
                fontSize: 10,
                letterSpacing: '0.2em',
                color: active ? '#FFB800' : '#555',
                borderBottom: `2px solid ${active ? '#FFB800' : 'transparent'}`,
                textDecoration: 'none',
                marginBottom: -1,
              }}
            >
              {tab.label}
            </a>
          )
        })}
      </nav>

      {/* ── Content ── */}
      <main style={{ padding: '28px', maxWidth: 1280, margin: '0 auto' }}>
        {children}
      </main>
    </div>
  )
}
