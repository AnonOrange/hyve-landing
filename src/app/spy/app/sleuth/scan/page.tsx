'use client'

// Hyve Sleuth — In-app OSINT Scanner.
//
// Sibling route to /spy/app/sleuth (the iframe-based smart launcher).
// This page is the scan-driven flow: user enters a name/email/phone/
// username, the worker fans out to OSINT adapters in parallel, and
// findings stream back into a person-profile view in-app.
//
// IMPORTANT: This is ADDITIVE. The existing /spy/app/sleuth route
// (the iframe smart launcher) is untouched and continues to work.

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  ALL_SOURCES,
  SOURCE_LABELS,
  SOURCE_QUERY_TYPES,
  formatDate,
  type PersonProfile,
  type ScanJob,
  type ScanQueryType,
} from '@/lib/sleuth/types'

const POLL_MS = 3000

export default function SleuthScanPage() {
  const [tier, setTier] = useState<'pro' | 'basic' | 'free' | null>(null)
  const [history, setHistory] = useState<ScanJob[]>([])
  const [activeScanId, setActiveScanId] = useState<string | null>(null)
  const [activeScan, setActiveScan] = useState<ScanJob | null>(null)
  const [results, setResults] = useState<PersonProfile[]>([])
  const [openProfile, setOpenProfile] = useState<PersonProfile | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(true)

  useEffect(() => {
    const m = document.cookie.match(/(?:^|; )hyve_spy_tier=([^;]+)/)
    setTier(m ? (m[1] as 'pro' | 'basic' | 'free') : 'free')
  }, [])

  const loadHistory = useCallback(async () => {
    try {
      const r = await fetch('/api/sleuth/scans', { cache: 'no-store' })
      if (!r.ok) {
        setHistory([])
        return
      }
      const d = await r.json()
      const scans: ScanJob[] = d.scans || []
      setHistory(scans)
      if (!activeScanId && scans.length > 0) {
        setActiveScanId(scans[0].id)
      }
    } finally {
      setLoadingHistory(false)
    }
  }, [activeScanId])

  useEffect(() => { loadHistory() }, [loadHistory])

  // Poll active scan
  useEffect(() => {
    if (!activeScanId) {
      setActiveScan(null)
      setResults([])
      return
    }
    let alive = true
    let timer: ReturnType<typeof setTimeout> | null = null

    async function tick() {
      try {
        const r = await fetch(`/api/sleuth/scan/${activeScanId}`, { cache: 'no-store' })
        if (!r.ok) return
        const d = await r.json()
        if (!alive) return
        setActiveScan(d.scan)
        setResults(d.results || [])
        if (d.scan && (d.scan.status === 'pending' || d.scan.status === 'running')) {
          timer = setTimeout(tick, POLL_MS)
        } else {
          loadHistory()
        }
      } catch {
        if (alive) timer = setTimeout(tick, POLL_MS)
      }
    }
    tick()
    return () => {
      alive = false
      if (timer) clearTimeout(timer)
    }
  }, [activeScanId, loadHistory])

  if (tier === null) {
    return (
      <main className="flex h-screen w-full items-center justify-center bg-[#020D14] text-[#94A3B8]">
        <div className="font-mono text-xs">checking access…</div>
      </main>
    )
  }
  if (tier !== 'pro') return <UpgradeGate />

  return (
    <main className="min-h-screen bg-[#020D14] pb-32 text-[#E2E8F0]">
      <div
        className="sticky top-0 z-20 border-b border-[#1c1724] bg-[#08070a]/95 backdrop-blur"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Image
            src="/spy-logo/hyve-sleuth-logo.png"
            alt="Hyve Sleuth"
            width={1536}
            height={1024}
            className="h-10 w-auto"
            priority
          />
          <div className="hidden sm:block">
            <div className="font-mono text-[10px] tracking-[0.3em] text-[#9e8a55]">
              IN-APP OSINT SCANNER · {ALL_SOURCES.length} SOURCES
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/spy/app/sleuth"
              className="rounded border border-[#2a2135] px-2.5 py-1 text-[10px] font-bold tracking-widest text-[#9e8a55] hover:border-[#C8A227] hover:text-[#C8A227]"
            >
              ↗ SMART LAUNCHER
            </Link>
            <NewScanButton onScanCreated={(id) => { setActiveScanId(id); loadHistory() }} />
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-4 px-4 pt-4 lg:grid-cols-[260px,1fr]">
        {/* Sidebar: scan history */}
        <aside className="lg:sticky lg:top-[88px] lg:self-start">
          <div className="text-[10px] font-bold tracking-[0.3em] text-[#C8A227]">SCAN HISTORY</div>
          <div className="mt-2 grid gap-1.5">
            {loadingHistory && (
              <div className="font-mono text-[10px] text-[#475569]">loading…</div>
            )}
            {!loadingHistory && history.length === 0 && (
              <div className="rounded border border-[#0D2235] bg-black/30 px-3 py-2 font-mono text-[10px] text-[#475569]">
                No scans yet. Click NEW SCAN.
              </div>
            )}
            {history.map((s) => {
              const active = s.id === activeScanId
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveScanId(s.id)}
                  className="rounded border px-2.5 py-1.5 text-left text-[10px] transition"
                  style={{
                    borderColor: active ? '#C8A227' : '#0D2235',
                    background: active ? '#C8A22712' : 'rgba(0,0,0,0.3)',
                    color: active ? '#C8A227' : '#94A3B8',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <StatusDot status={s.status} />
                    <span className="truncate font-bold uppercase">
                      {s.queryType}: {s.queryValue}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between font-mono text-[9px] text-[#64748B]">
                    <span>{relTime(s.createdAt)}</span>
                    <span>{s.resultCount} hits</span>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        {/* Main pane */}
        <section>
          {!activeScanId && history.length === 0 && !loadingHistory && (
            <FirstScanEmpty
              onScanCreated={(id) => {
                setActiveScanId(id)
                loadHistory()
              }}
            />
          )}

          {activeScanId && (
            <div>
              {activeScan && (
                <div className="mb-3 rounded border border-[#0D2235] bg-black/30 px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-bold tracking-[0.3em] text-[#C8A227]">
                        {activeScan.queryType.toUpperCase()} SCAN
                      </div>
                      <div className="text-base font-black">{activeScan.queryValue}</div>
                      {(activeScan.queryState || activeScan.queryCity) && (
                        <div className="font-mono text-[10px] text-[#64748B]">
                          {activeScan.queryCity ? `${activeScan.queryCity}, ` : ''}
                          {activeScan.queryState || ''}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <StatusBadge status={activeScan.status} />
                      <div className="mt-1 font-mono text-[10px] text-[#64748B]">
                        {results.length} {results.length === 1 ? 'hit' : 'hits'} found
                      </div>
                    </div>
                  </div>
                  <ScanProgress scan={activeScan} />
                  {activeScan.error && (
                    <div className="mt-2 rounded border border-[#7f1d1d] bg-[#3a0a0a]/40 px-3 py-2 font-mono text-[10px] text-[#fca5a5]">
                      Error: {activeScan.error}
                    </div>
                  )}
                </div>
              )}

              {results.length > 0 && (
                <ul className="grid gap-2">
                  {results.map((p) => (
                    <PersonRow
                      key={`${p.person.personId}-${p.person.source}`}
                      profile={p}
                      onOpen={() => setOpenProfile(p)}
                    />
                  ))}
                </ul>
              )}
              {activeScan?.status === 'completed' && results.length === 0 && (
                <div className="rounded border border-[#0D2235] bg-black/30 px-4 py-8 text-center font-mono text-[11px] text-[#64748B]">
                  Scan complete — no results matched. Try a broader query, different source set, or
                  check the &quot;Smart Launcher&quot; for additional manually-launched OSINT resources.
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {openProfile && <ProfileDrawer profile={openProfile} onClose={() => setOpenProfile(null)} />}
    </main>
  )
}

// ─── New-scan UI ─────────────────────────────────────────────────────────

function NewScanButton({ onScanCreated }: { onScanCreated: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded px-4 py-2 text-[10px] font-black tracking-widest text-[#020D14]"
        style={{ background: 'linear-gradient(135deg, #C8A227, #E8C456)' }}
      >
        + NEW SCAN
      </button>
      {open && <ScanModal onClose={() => setOpen(false)} onScanCreated={(id) => { setOpen(false); onScanCreated(id) }} />}
    </>
  )
}

function FirstScanEmpty({ onScanCreated }: { onScanCreated: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-lg border border-[#0D2235] bg-black/30 px-6 py-10 text-center">
      <div className="mx-auto max-w-md">
        <div className="text-[10px] font-bold tracking-[0.3em] text-[#C8A227]">START INVESTIGATING</div>
        <h2 className="mt-2 text-2xl font-black">In-app OSINT, fanned out across 8 free sources.</h2>
        <p className="mt-3 text-sm text-[#94A3B8]">
          Search by name, email, phone, username, or address. We fan out to Have I Been Pwned,
          GitHub, Gravatar, Sherlock (300+ social sites), OpenCorporates, USPTO, the FAA airman
          registry, and the National Sex Offender Registry — and aggregate the hits into per-person
          profiles in-app.
        </p>
        <button
          onClick={() => setOpen(true)}
          className="mt-6 inline-block rounded px-6 py-3 text-sm font-black tracking-widest text-[#020D14]"
          style={{ background: 'linear-gradient(135deg, #C8A227, #E8C456)' }}
        >
          RUN YOUR FIRST SCAN →
        </button>
        <div className="mt-4 font-mono text-[10px] text-[#475569]">
          Scans take 30 seconds to ~3 minutes depending on source mix.
        </div>
      </div>
      {open && <ScanModal onClose={() => setOpen(false)} onScanCreated={(id) => { setOpen(false); onScanCreated(id) }} />}
    </div>
  )
}

function ScanModal({ onClose, onScanCreated }: { onClose: () => void; onScanCreated: (id: string) => void }) {
  const [queryType, setQueryType] = useState<ScanQueryType>('name')
  const [queryValue, setQueryValue] = useState('')
  const [queryState, setQueryState] = useState('')
  const [queryCity, setQueryCity] = useState('')
  const [sourceFilter, setSourceFilter] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allSelected = sourceFilter.length === 0

  // Sources available for the active query type
  const compatibleSources = useMemo(
    () => ALL_SOURCES.filter((s) => SOURCE_QUERY_TYPES[s]?.includes(queryType)),
    [queryType],
  )

  async function submit() {
    setSubmitting(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        queryType,
        queryValue: queryValue.trim(),
      }
      if (queryState.trim()) body.queryState = queryState.trim().toUpperCase()
      if (queryCity.trim()) body.queryCity = queryCity.trim()
      if (sourceFilter.length > 0) body.sourceFilter = sourceFilter

      const r = await fetch('/api/sleuth/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.detail || d.error || 'scan_failed')
      onScanCreated(d.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'scan_failed')
    } finally {
      setSubmitting(false)
    }
  }

  function toggleSource(code: string) {
    setSourceFilter((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    )
  }

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/85 px-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg rounded-lg border border-[#C8A227]/40 bg-[#08070a] p-6">
        <div className="text-[10px] font-bold tracking-[0.3em] text-[#C8A227]">NEW OSINT SCAN</div>
        <h3 className="mt-1 text-xl font-black">Search across 8 free OSINT sources</h3>

        <div className="mt-4">
          <div className="text-[10px] font-bold tracking-widest text-[#475569]">SEARCH BY</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {(['name', 'email', 'phone', 'username', 'address'] as ScanQueryType[]).map((t) => (
              <button
                key={t}
                onClick={() => setQueryType(t)}
                className="rounded border px-3 py-1.5 text-[10px] font-bold tracking-widest"
                style={{
                  borderColor: queryType === t ? '#C8A227' : '#0D2235',
                  background: queryType === t ? '#C8A22712' : 'transparent',
                  color: queryType === t ? '#C8A227' : '#94A3B8',
                }}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <label className="text-[10px] font-bold tracking-widest text-[#475569]">
            {queryType === 'name' && 'FULL NAME'}
            {queryType === 'email' && 'EMAIL ADDRESS'}
            {queryType === 'phone' && 'PHONE NUMBER'}
            {queryType === 'username' && 'USERNAME / HANDLE'}
            {queryType === 'address' && 'STREET ADDRESS'}
          </label>
          <input
            type="text"
            value={queryValue}
            onChange={(e) => setQueryValue(e.target.value)}
            autoFocus
            placeholder={
              queryType === 'name' ? 'Jane Doe' :
              queryType === 'email' ? 'jane@example.com' :
              queryType === 'phone' ? '555-123-4567' :
              queryType === 'username' ? 'janedoe42' :
              '123 Main St'
            }
            className="mt-1 w-full rounded border border-[#0D2235] bg-black/60 px-3 py-2 text-sm text-white placeholder-[#334155] outline-none focus:border-[#C8A227]"
          />
        </div>

        {(queryType === 'name' || queryType === 'address') && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold tracking-widest text-[#475569]">
                CITY (OPTIONAL)
              </label>
              <input
                type="text"
                value={queryCity}
                onChange={(e) => setQueryCity(e.target.value)}
                placeholder="Charlotte"
                className="mt-1 w-full rounded border border-[#0D2235] bg-black/60 px-3 py-2 text-sm text-white placeholder-[#334155] outline-none focus:border-[#C8A227]"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold tracking-widest text-[#475569]">
                STATE (OPTIONAL)
              </label>
              <input
                type="text"
                value={queryState}
                onChange={(e) => setQueryState(e.target.value.toUpperCase().slice(0, 2))}
                maxLength={2}
                placeholder="NC"
                className="mt-1 w-full rounded border border-[#0D2235] bg-black/60 px-3 py-2 text-sm uppercase text-white placeholder-[#334155] outline-none focus:border-[#C8A227]"
              />
            </div>
          </div>
        )}

        <div className="mt-4">
          <div className="flex items-baseline justify-between">
            <div className="text-[10px] font-bold tracking-widest text-[#475569]">
              SOURCES {allSelected ? '(ALL COMPATIBLE)' : `(${sourceFilter.length} SELECTED)`}
            </div>
            {!allSelected && (
              <button
                onClick={() => setSourceFilter([])}
                className="font-mono text-[10px] text-[#C8A227] hover:underline"
              >
                use all
              </button>
            )}
          </div>
          <div className="mt-1 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {ALL_SOURCES.map((s) => {
              const compatible = compatibleSources.includes(s)
              const selected = (sourceFilter.includes(s) || allSelected) && compatible
              return (
                <button
                  key={s}
                  disabled={!compatible}
                  onClick={() => toggleSource(s)}
                  className="rounded border px-2 py-1.5 text-left text-[10px] transition"
                  style={{
                    borderColor: !compatible ? '#0D2235' : selected ? '#C8A22740' : '#0D2235',
                    background: !compatible ? 'transparent' : selected ? '#C8A2270C' : 'transparent',
                    color: !compatible ? '#334155' : selected ? '#C8A227' : '#475569',
                    cursor: compatible ? 'pointer' : 'not-allowed',
                  }}
                >
                  <div className="font-bold tracking-widest">{s}</div>
                  <div className="font-mono text-[8px] opacity-70">{SOURCE_LABELS[s] || s}</div>
                </button>
              )
            })}
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded border border-[#7f1d1d] bg-[#3a0a0a]/40 px-3 py-2 font-mono text-[10px] text-[#fca5a5]">
            {error}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded border border-[#0D2235] bg-transparent px-4 py-2 text-[10px] font-bold tracking-widest text-[#94A3B8]"
          >
            CANCEL
          </button>
          <button
            onClick={submit}
            disabled={submitting || !queryValue.trim()}
            className="rounded px-4 py-2 text-[10px] font-black tracking-widest text-[#020D14] disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #C8A227, #E8C456)' }}
          >
            {submitting ? 'STARTING…' : 'RUN SCAN →'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Active-scan progress ───────────────────────────────────────────────

function ScanProgress({ scan }: { scan: ScanJob }) {
  if (scan.status !== 'pending' && scan.status !== 'running') return null

  const perSource = scan.progress?.per_source || {}
  const total = scan.progress?.sources_total ?? Object.keys(perSource).length
  const done = scan.progress?.sources_done ?? Object.values(perSource).filter((s) => s.status === 'done' || s.status === 'failed').length
  const pct = total > 0 ? Math.round((done / total) * 100) : (scan.status === 'pending' ? 5 : 25)

  return (
    <div className="mt-3">
      <div className="h-1.5 w-full overflow-hidden rounded bg-[#0D2235]">
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #C8A227, #E8C456)' }}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {Object.entries(perSource).map(([code, info]) => (
          <span
            key={code}
            className="rounded px-2 py-0.5 font-mono text-[9px]"
            style={{
              border: '1px solid',
              borderColor:
                info.status === 'done' ? '#22C55E60' :
                info.status === 'running' ? '#C8A22760' :
                info.status === 'failed' ? '#EF444460' :
                '#0D2235',
              color:
                info.status === 'done' ? '#22C55E' :
                info.status === 'running' ? '#C8A227' :
                info.status === 'failed' ? '#EF4444' :
                '#475569',
              background:
                info.status === 'done' ? '#22C55E0C' :
                info.status === 'running' ? '#C8A2270C' :
                'transparent',
            }}
          >
            {code} {info.status === 'done' ? `· ${info.count}` : info.status}
          </span>
        ))}
      </div>
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'completed' ? '#22C55E' :
    status === 'running' ? '#C8A227' :
    status === 'pending' ? '#94A3B8' :
    status === 'failed' ? '#EF4444' : '#475569'
  return (
    <span
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{
        background: color,
        boxShadow: status === 'running' ? `0 0 8px ${color}` : 'none',
      }}
    />
  )
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === 'completed' ? '#22C55E' :
    status === 'running' ? '#C8A227' :
    status === 'pending' ? '#94A3B8' :
    status === 'failed' ? '#EF4444' : '#475569'
  return (
    <span
      className="rounded px-2 py-0.5 text-[9px] font-bold tracking-widest"
      style={{ border: `1px solid ${color}60`, color, background: `${color}15` }}
    >
      {status.toUpperCase()}
    </span>
  )
}

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`
  return `${Math.floor(ms / 86_400_000)}d ago`
}

// ─── Person row + drawer ────────────────────────────────────────────────

function PersonRow({ profile, onOpen }: { profile: PersonProfile; onOpen: () => void }) {
  const { person, matchScore, signals, breaches, businesses, licenses, courtRecords, usernames } = profile
  const scoreColor = matchScore >= 80 ? '#22C55E' : matchScore >= 50 ? '#C8A227' : matchScore >= 20 ? '#FBBF24' : '#475569'
  const name = person.fullName ||
    [person.firstName, person.middleName, person.lastName].filter(Boolean).join(' ') ||
    '(unnamed result)'

  return (
    <li>
      <button
        onClick={onOpen}
        className="flex w-full items-center gap-4 rounded border border-[#0D2235] bg-black/30 px-4 py-3 text-left transition hover:border-[#C8A227]"
      >
        <div className="shrink-0 text-center">
          <div className="text-2xl font-black" style={{ color: scoreColor }}>
            {matchScore}
          </div>
          <div className="font-mono text-[8px] tracking-widest text-[#475569]">MATCH</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="truncate text-sm font-black">{name}</h3>
            {(person.city || person.state) && (
              <span className="font-mono text-[10px] text-[#64748B]">
                {person.city ? `${person.city}, ` : ''}{person.state || ''}
              </span>
            )}
          </div>
          {person.occupation && (
            <div className="mt-0.5 truncate text-[11px] text-[#94A3B8]">{person.occupation}</div>
          )}
          <div className="mt-1 flex flex-wrap gap-1.5">
            <span className="rounded border border-[#C8A227]/40 bg-[#C8A227]/10 px-2 py-0.5 text-[9px] font-bold tracking-widest text-[#C8A227]">
              {person.source}
            </span>
            {breaches.length > 0 && (
              <span className="rounded border border-[#EF4444]/40 bg-[#EF4444]/10 px-2 py-0.5 text-[9px] font-bold tracking-widest text-[#EF4444]">
                ⚠ {breaches.length} BREACH{breaches.length === 1 ? '' : 'ES'}
              </span>
            )}
            {businesses.length > 0 && (
              <span className="rounded border border-[#0D2235] bg-black/40 px-2 py-0.5 text-[9px] text-[#94A3B8]">
                {businesses.length} business
              </span>
            )}
            {licenses.length > 0 && (
              <span className="rounded border border-[#0D2235] bg-black/40 px-2 py-0.5 text-[9px] text-[#94A3B8]">
                {licenses.length} license
              </span>
            )}
            {courtRecords.length > 0 && (
              <span className="rounded border border-[#0D2235] bg-black/40 px-2 py-0.5 text-[9px] text-[#94A3B8]">
                {courtRecords.length} court
              </span>
            )}
            {usernames.length > 0 && (
              <span className="rounded border border-[#0D2235] bg-black/40 px-2 py-0.5 text-[9px] text-[#94A3B8]">
                {usernames.length} handle{usernames.length === 1 ? '' : 's'}
              </span>
            )}
            {signals.slice(0, 2).map((s, i) => (
              <span key={i} className="rounded border border-[#0D2235] bg-black/40 px-2 py-0.5 text-[9px] text-[#94A3B8]">
                {s}
              </span>
            ))}
          </div>
        </div>
        <div className="shrink-0 text-2xl text-[#475569]">→</div>
      </button>
    </li>
  )
}

function ProfileDrawer({ profile, onClose }: { profile: PersonProfile; onClose: () => void }) {
  const { person, matchScore, emails, phones, addresses, usernames, breaches, courtRecords, businesses, licenses, newsMentions } = profile
  const name = person.fullName ||
    [person.firstName, person.middleName, person.lastName].filter(Boolean).join(' ') ||
    '(unnamed result)'

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-[#C8A227]/40 bg-[#020D14] sm:rounded-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-[#0D2235] bg-[#020D14] px-5 py-3">
          <div>
            <div className="text-[10px] font-bold tracking-[0.3em] text-[#C8A227]">
              {person.source} · {person.personId.slice(0, 12)}
            </div>
            <h2 className="text-lg font-black">{name}</h2>
            {(person.city || person.state) && (
              <div className="font-mono text-[10px] text-[#64748B]">
                {person.city ? `${person.city}, ` : ''}{person.state || ''}{person.zip ? ` ${person.zip}` : ''}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded border border-[#0D2235] px-2 py-1 text-[10px] font-bold tracking-widest text-[#94A3B8] hover:border-[#C8A227] hover:text-[#C8A227]"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded border border-[#0D2235] bg-black/40 p-3">
              <div className="text-[9px] font-bold tracking-widest text-[#475569]">MATCH SCORE</div>
              <div className="mt-1 text-3xl font-black" style={{ color: matchScore >= 50 ? '#22C55E' : '#C8A227' }}>
                {matchScore}
              </div>
            </div>
            <div className="rounded border border-[#0D2235] bg-black/40 p-3">
              <div className="text-[9px] font-bold tracking-widest text-[#475569]">AGE / DOB</div>
              <div className="mt-1 text-sm font-bold">
                {person.age ? `${person.age}yo` : '—'} {person.dob ? `· ${formatDate(person.dob)}` : ''}
              </div>
            </div>
            <div className="rounded border border-[#0D2235] bg-black/40 p-3">
              <div className="text-[9px] font-bold tracking-widest text-[#475569]">OCCUPATION</div>
              <div className="mt-1 text-sm font-bold">{person.occupation || '—'}</div>
            </div>
          </div>

          {person.bio && (
            <div className="mt-5">
              <div className="text-[10px] font-bold tracking-[0.3em] text-[#C8A227]">BIO</div>
              <div className="mt-1 rounded border border-[#0D2235] bg-black/30 p-3 text-sm text-[#94A3B8]">
                {person.bio}
              </div>
            </div>
          )}

          {emails.length > 0 && (
            <Section title="EMAILS">
              {emails.map((e) => (
                <li key={`${e.source}-${e.email}`} className="flex items-center justify-between rounded border border-[#0D2235] bg-black/30 px-3 py-1.5 text-xs">
                  <span className="font-mono text-[11px]">{e.email}</span>
                  <span className="font-mono text-[9px] text-[#475569]">{e.source}</span>
                </li>
              ))}
            </Section>
          )}

          {phones.length > 0 && (
            <Section title="PHONES">
              {phones.map((p) => (
                <li key={`${p.source}-${p.phone}`} className="flex items-center justify-between rounded border border-[#0D2235] bg-black/30 px-3 py-1.5 text-xs">
                  <span className="font-mono text-[11px]">{p.phone}</span>
                  <span className="font-mono text-[9px] text-[#475569]">{p.carrier || p.lineType || p.source}</span>
                </li>
              ))}
            </Section>
          )}

          {addresses.length > 0 && (
            <Section title="ADDRESSES">
              {addresses.map((a, i) => (
                <li key={`${a.source}-${i}`} className="rounded border border-[#0D2235] bg-black/30 px-3 py-1.5 text-xs">
                  <div className="font-mono text-[11px]">{a.address || '—'}{a.city ? `, ${a.city}` : ''}{a.state ? ` ${a.state}` : ''}{a.zip ? ` ${a.zip}` : ''}</div>
                  {a.dateSeen && <div className="font-mono text-[9px] text-[#475569]">seen {formatDate(a.dateSeen)}</div>}
                </li>
              ))}
            </Section>
          )}

          {usernames.length > 0 && (
            <Section title={`USERNAMES (${usernames.length})`}>
              {usernames.map((u) => (
                <li key={`${u.source}-${u.platform}-${u.handle}`} className="flex items-center justify-between rounded border border-[#0D2235] bg-black/30 px-3 py-1.5 text-xs">
                  <span>
                    <span className="font-mono text-[10px] uppercase text-[#C8A227]">{u.platform}</span>
                    <span className="ml-2 font-mono text-[11px]">@{u.handle}</span>
                  </span>
                  {u.url && (
                    <a href={u.url} target="_blank" rel="noreferrer" className="font-mono text-[9px] text-[#C8A227] hover:underline">
                      open ↗
                    </a>
                  )}
                </li>
              ))}
            </Section>
          )}

          {breaches.length > 0 && (
            <Section title={`DATA BREACHES (${breaches.length})`} accent="#EF4444">
              {breaches.map((b) => (
                <li key={b.id} className="rounded border border-[#7f1d1d]/40 bg-[#3a0a0a]/30 px-3 py-2 text-xs">
                  <div className="flex items-baseline justify-between">
                    <span className="font-bold text-[#fca5a5]">{b.breachName}</span>
                    {b.breachDate && <span className="font-mono text-[9px] text-[#64748B]">{formatDate(b.breachDate)}</span>}
                  </div>
                  {b.dataClasses && b.dataClasses.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {b.dataClasses.map((c) => (
                        <span key={c} className="rounded bg-[#7f1d1d]/40 px-1.5 py-0.5 font-mono text-[8px] text-[#fecaca]">{c}</span>
                      ))}
                    </div>
                  )}
                  {b.description && <div className="mt-1 text-[10px] text-[#94A3B8]">{b.description}</div>}
                </li>
              ))}
            </Section>
          )}

          {businesses.length > 0 && (
            <Section title={`BUSINESS AFFILIATIONS (${businesses.length})`}>
              {businesses.map((b) => (
                <li key={b.id} className="rounded border border-[#0D2235] bg-black/30 px-3 py-1.5 text-xs">
                  <div className="font-bold">{b.companyName}</div>
                  <div className="font-mono text-[9px] text-[#64748B]">
                    {b.role ? `${b.role.toUpperCase()} · ` : ''}
                    {b.state ? `${b.state} · ` : ''}
                    {b.status || ''}
                    {b.formedDate ? ` · formed ${formatDate(b.formedDate)}` : ''}
                  </div>
                </li>
              ))}
            </Section>
          )}

          {licenses.length > 0 && (
            <Section title={`LICENSES (${licenses.length})`}>
              {licenses.map((l) => (
                <li key={l.id} className="rounded border border-[#0D2235] bg-black/30 px-3 py-1.5 text-xs">
                  <div className="flex items-baseline justify-between">
                    <span className="font-bold uppercase text-[#C8A227]">{l.type}</span>
                    {l.authority && <span className="font-mono text-[9px] text-[#64748B]">{l.authority}</span>}
                  </div>
                  <div className="font-mono text-[10px] text-[#94A3B8]">
                    {l.number || '—'}
                    {l.status ? ` · ${l.status}` : ''}
                    {l.issuedDate ? ` · issued ${formatDate(l.issuedDate)}` : ''}
                    {l.expiresDate ? ` · expires ${formatDate(l.expiresDate)}` : ''}
                  </div>
                </li>
              ))}
            </Section>
          )}

          {courtRecords.length > 0 && (
            <Section title={`COURT RECORDS (${courtRecords.length})`}>
              {courtRecords.map((c) => (
                <li key={c.id} className="rounded border border-[#0D2235] bg-black/30 px-3 py-1.5 text-xs">
                  <div className="font-bold">{c.caseNumber || c.caseType || 'Court record'}</div>
                  <div className="font-mono text-[9px] text-[#64748B]">
                    {c.court ? `${c.court} · ` : ''}
                    {c.caseType || ''}
                    {c.filedDate ? ` · filed ${formatDate(c.filedDate)}` : ''}
                    {c.status ? ` · ${c.status}` : ''}
                  </div>
                  {c.description && <div className="mt-0.5 text-[10px] text-[#94A3B8]">{c.description}</div>}
                </li>
              ))}
            </Section>
          )}

          {newsMentions.length > 0 && (
            <Section title={`NEWS MENTIONS (${newsMentions.length})`}>
              {newsMentions.map((n) => (
                <li key={n.id} className="rounded border border-[#0D2235] bg-black/30 px-3 py-1.5 text-xs">
                  <a href={n.url} target="_blank" rel="noreferrer" className="font-bold text-[#C8A227] hover:underline">
                    {n.title || n.url}
                  </a>
                  <div className="font-mono text-[9px] text-[#64748B]">
                    {n.publisher ? `${n.publisher} · ` : ''}
                    {n.date ? formatDate(n.date) : ''}
                  </div>
                  {n.snippet && <div className="mt-0.5 text-[10px] text-[#94A3B8]">{n.snippet}</div>}
                </li>
              ))}
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ title, children, accent }: { title: string; children: React.ReactNode; accent?: string }) {
  return (
    <div className="mt-5">
      <div className="text-[10px] font-bold tracking-[0.3em]" style={{ color: accent || '#C8A227' }}>{title}</div>
      <ul className="mt-1 grid gap-1">{children}</ul>
    </div>
  )
}

function UpgradeGate() {
  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-[#08070a] px-6 py-12 text-[#ede8d8]">
      <div className="max-w-md text-center">
        <Image
          src="/spy-logo/hyve-sleuth-logo.png"
          alt="Hyve Sleuth"
          width={1536}
          height={1024}
          className="mx-auto h-auto w-full max-w-sm"
          priority
        />
        <div className="mt-2 font-mono text-[11px] tracking-widest text-[#9e8a55]">
          IN-APP OSINT SCANNER · PRO
        </div>
        <p className="mt-5 text-sm leading-relaxed text-[#94A3B8]">
          Run unlimited <span className="text-white">OSINT scans</span> in-app — name, email, phone,
          username, or address. Results aggregated from 8 free sources: Have I Been Pwned, GitHub,
          Gravatar, Sherlock (300+ social sites), OpenCorporates, USPTO, FAA airman registry, and
          the National Sex Offender Registry.
        </p>
        <a
          href="/spy#pricing"
          className="mt-7 inline-block rounded px-6 py-3 text-sm font-black tracking-widest text-[#020D14]"
          style={{
            background: 'linear-gradient(135deg, #C8A227, #E8C456)',
            boxShadow: '0 0 60px -10px rgba(200,162,39,0.5)',
          }}
        >
          UPGRADE TO PRO →
        </a>
      </div>
    </main>
  )
}
