// Top-level Co-App shell. Phone-first layout with a sticky header,
// scrolling content, and a bottom tab bar — same UX language as iOS Mail,
// Slack, etc. so it feels native when installed as a PWA.

'use client'

import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './lib/auth'
import { getActiveCaseId, setActiveCaseId, subscribeToCases, type CoCase } from './lib/cases'
import CasesTab from './tabs/CasesTab'
import NotesTab from './tabs/NotesTab'
import CaseyTab from './tabs/CaseyTab'
import FilesTab from './tabs/FilesTab'
import LiveTab from './tabs/LiveTab'
import SettingsTab from './tabs/SettingsTab'
import SignInGate from './components/SignInGate'

export type TabId = 'cases' | 'notes' | 'live' | 'casey' | 'files' | 'settings'

const ACCENT = '#00B4D8'

export default function CoAppShell() {
  return (
    <AuthProvider>
      <Inner />
    </AuthProvider>
  )
}

function Inner() {
  const { user, loading } = useAuth()
  const [tab, setTab] = useState<TabId>('cases')
  const [cases, setCases] = useState<CoCase[]>([])
  const [activeCaseId, setActiveCaseIdState] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : getActiveCaseId(),
  )

  // Real-time case subscription once we have a uid.
  useEffect(() => {
    if (!user) return
    const unsub = subscribeToCases(user.uid, setCases)
    return () => unsub()
  }, [user])

  // Default active case if none is set and we have cases.
  useEffect(() => {
    if (!activeCaseId && cases.length > 0) {
      setActiveCaseIdState(cases[0].id)
      setActiveCaseId(cases[0].id)
    }
  }, [cases, activeCaseId])

  function chooseCase(id: string) {
    setActiveCaseIdState(id)
    setActiveCaseId(id)
  }

  if (loading) {
    return (
      <main className="co-app-root co-app-loading">
        <div className="co-app-pulse">CASELINE</div>
      </main>
    )
  }

  if (!user) {
    return <SignInGate />
  }

  const active = cases.find((c) => c.id === activeCaseId) ?? null

  return (
    <main className="co-app-root">
      <header className="co-app-header">
        <div className="co-app-title">
          <div className="co-app-brand">CASELINE</div>
          <div className="co-app-active-case" title={active?.caseTitle ?? 'No case selected'}>
            {active ? (
              <>
                <span className="co-app-active-label">CASE</span>
                <span className="co-app-active-name">{active.caseTitle ?? '(untitled)'}</span>
              </>
            ) : (
              <span className="co-app-active-empty">No case selected</span>
            )}
          </div>
        </div>
        <button
          type="button"
          className="co-app-switch"
          onClick={() => setTab('cases')}
          aria-label="Switch case"
        >
          ⇄
        </button>
      </header>

      <section className="co-app-content">
        {tab === 'cases'    && <CasesTab    cases={cases} activeCaseId={activeCaseId} onChoose={chooseCase} />}
        {tab === 'notes'    && <NotesTab    user={user} active={active} />}
        {tab === 'live'     && <LiveTab     user={user} active={active} />}
        {tab === 'casey'    && <CaseyTab    user={user} active={active} />}
        {tab === 'files'    && <FilesTab    active={active} />}
        {tab === 'settings' && <SettingsTab />}
      </section>

      <nav className="co-app-tabbar" role="tablist">
        <TabBtn id="cases"    label="Cases"   icon="□" active={tab === 'cases'}    onClick={() => setTab('cases')} />
        <TabBtn id="notes"    label="Notes"   icon="●" active={tab === 'notes'}    onClick={() => setTab('notes')} />
        <TabBtn id="live"     label="Live"    icon="◉" active={tab === 'live'}     onClick={() => setTab('live')} />
        <TabBtn id="casey"    label="CaSeY"   icon="✦" active={tab === 'casey'}    onClick={() => setTab('casey')} />
        <TabBtn id="files"    label="Files"   icon="◫" active={tab === 'files'}    onClick={() => setTab('files')} />
        <TabBtn id="settings" label="More"    icon="≡" active={tab === 'settings'} onClick={() => setTab('settings')} />
      </nav>

      <style jsx global>{`
        :root {
          --co-bg: #08070a;
          --co-panel: #11121a;
          --co-border: #2a2135;
          --co-text: #ede8d8;
          --co-muted: #9e8a55;
          --co-accent: ${ACCENT};
          --co-accent-faint: ${ACCENT}1a;
        }
        html, body { background: var(--co-bg); color: var(--co-text); margin: 0; }
        body { overscroll-behavior-y: none; }
        .co-app-root {
          min-height: 100svh;
          display: grid;
          grid-template-rows: auto 1fr auto;
          background: var(--co-bg);
          color: var(--co-text);
          font-family: 'Inter', system-ui, sans-serif;
          padding-top: env(safe-area-inset-top);
          padding-bottom: env(safe-area-inset-bottom);
        }
        .co-app-loading {
          place-items: center;
          font-family: 'Courier New', monospace;
          letter-spacing: 0.4em;
          color: var(--co-accent);
        }
        .co-app-pulse {
          animation: co-pulse 1.6s ease-in-out infinite;
        }
        @keyframes co-pulse { 0%, 100% { opacity: 0.3 } 50% { opacity: 1 } }

        .co-app-header {
          position: sticky; top: 0; z-index: 10;
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px;
          padding: 12px 16px;
          background: linear-gradient(180deg, rgba(8,7,10,0.96), rgba(8,7,10,0.85));
          backdrop-filter: blur(8px);
          border-bottom: 1px solid var(--co-border);
        }
        .co-app-title { flex: 1; min-width: 0; }
        .co-app-brand {
          font-family: 'Courier New', monospace;
          font-size: 10px;
          letter-spacing: 0.4em;
          color: var(--co-accent);
        }
        .co-app-active-case {
          display: flex; align-items: baseline; gap: 8px;
          margin-top: 4px;
        }
        .co-app-active-label {
          font-family: 'Courier New', monospace;
          font-size: 9px;
          letter-spacing: 0.3em;
          color: var(--co-muted);
        }
        .co-app-active-name {
          font-size: 15px; font-weight: 700;
          color: var(--co-text);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .co-app-active-empty {
          font-size: 13px; color: var(--co-muted); font-style: italic;
        }
        .co-app-switch {
          font-size: 18px; padding: 6px 10px;
          background: transparent; border: 1px solid var(--co-border);
          border-radius: 6px; color: var(--co-accent); cursor: pointer;
        }

        .co-app-content {
          overflow-y: auto;
          padding: 14px 16px 80px;
        }

        .co-app-tabbar {
          position: sticky; bottom: 0; z-index: 10;
          display: grid; grid-template-columns: repeat(6, 1fr);
          gap: 4px;
          padding: 6px 6px calc(6px + env(safe-area-inset-bottom));
          background: rgba(8,7,10,0.96);
          backdrop-filter: blur(8px);
          border-top: 1px solid var(--co-border);
        }
        .co-tab {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 2px; padding: 6px 4px;
          background: transparent; border: none; cursor: pointer;
          color: var(--co-muted);
          font-family: inherit;
          font-size: 10px; letter-spacing: 0.05em;
          border-radius: 8px;
          transition: background 120ms, color 120ms;
        }
        .co-tab[aria-selected="true"] {
          color: var(--co-accent);
          background: var(--co-accent-faint);
        }
        .co-tab-icon { font-size: 18px; line-height: 1; }
      `}</style>
    </main>
  )
}

function TabBtn({ id, label, icon, active, onClick }: { id: TabId; label: string; icon: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-label={label}
      id={`co-tab-${id}`}
      className="co-tab"
      onClick={onClick}
    >
      <span className="co-tab-icon">{icon}</span>
      <span>{label}</span>
    </button>
  )
}
