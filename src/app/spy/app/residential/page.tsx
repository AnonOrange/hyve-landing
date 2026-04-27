'use client'

// HYVE Residential — nationwide distressed-property scanner.
//
// User flow:
//   1. Empty state → "Run your first scan" form
//   2. POST /api/residential/scan → returns scan id, status='pending'
//   3. UI flips to the active-scan view, polls /api/residential/scan/[id]
//      every 3s. While pending/running, a progress bar shows per-source
//      status from scan.progress.per_source.
//   4. When status='completed', the property rows + profile drawer render
//      from the same DistressProfile shape the demo dashboard used.
//
// All data flows from the Railway worker → Supabase → these API routes.
// No hardcoded data anywhere.

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import {
  formatCurrency,
  stageLabel,
  stageColor,
  ALL_SOURCES,
  SOURCE_LABELS,
  type DistressProfile,
  type ScanJob,
  type ScanQueryType,
} from '@/lib/residential'

const POLL_MS = 3000

export default function ResidentialPage() {
  const [tier, setTier] = useState<'pro' | 'basic' | 'free' | null>(null)
  const [history, setHistory] = useState<ScanJob[]>([])
  const [activeScanId, setActiveScanId] = useState<string | null>(null)
  const [activeScan, setActiveScan] = useState<ScanJob | null>(null)
  const [results, setResults] = useState<DistressProfile[]>([])
  const [openProfile, setOpenProfile] = useState<DistressProfile | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(true)

  // Tier check via cookie (same pattern as before — server enforces too)
  useEffect(() => {
    const m = document.cookie.match(/(?:^|; )hyve_spy_tier=([^;]+)/)
    setTier(m ? (m[1] as 'pro' | 'basic' | 'free') : 'free')
  }, [])

  // Initial scan history load
  const loadHistory = useCallback(async () => {
    try {
      const r = await fetch('/api/residential/scans', { cache: 'no-store' })
      if (!r.ok) {
        setHistory([])
        return
      }
      const d = await r.json()
      const scans: ScanJob[] = d.scans || []
      setHistory(scans)
      // Default to most recent completed scan if no active selection
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
        const r = await fetch(`/api/residential/scan/${activeScanId}`, { cache: 'no-store' })
        if (!r.ok) return
        const d = await r.json()
        if (!alive) return
        setActiveScan(d.scan)
        setResults(d.results || [])
        if (d.scan && (d.scan.status === 'pending' || d.scan.status === 'running')) {
          timer = setTimeout(tick, POLL_MS)
        } else {
          // Refresh history once a scan finishes (updates result_count badge)
          loadHistory()
        }
      } catch {
        // Transient — try again
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
      {/* Header */}
      <div
        className="sticky top-0 z-20 border-b border-[#1c1724] bg-[#08070a]/95 backdrop-blur"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Image
            src="/spy-logo/hyve-residential-logo.png"
            alt="Hyve Residential"
            width={1536}
            height={1024}
            className="h-12 w-auto"
            priority
          />
          <div className="hidden sm:block">
            <div className="font-mono text-[10px] tracking-[0.3em] text-[#9e8a55]">
              NATIONWIDE DISTRESS INTEL · {ALL_SOURCES.length} FEDERAL SOURCES
            </div>
          </div>
          <div className="ml-auto" />
          <NewScanButton onScanCreated={(id) => { setActiveScanId(id); loadHistory() }} />
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-4 px-4 pt-4 lg:grid-cols-[260px,1fr]">
        {/* Sidebar: scan history */}
        <aside className="lg:sticky lg:top-[88px] lg:self-start">
          <div className="text-[10px] font-bold tracking-[0.3em] text-[#F59E0B]">SCAN HISTORY</div>
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
                    borderColor: active ? '#F59E0B' : '#0D2235',
                    background: active ? '#F59E0B12' : 'rgba(0,0,0,0.3)',
                    color: active ? '#F59E0B' : '#94A3B8',
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

        {/* Main pane: active scan */}
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
                      <div className="text-[10px] font-bold tracking-[0.3em] text-[#F59E0B]">
                        {activeScan.queryType.toUpperCase()} SCAN
                      </div>
                      <div className="text-base font-black">{activeScan.queryValue}</div>
                      {activeScan.queryState && (
                        <div className="font-mono text-[10px] text-[#64748B]">
                          State filter: {activeScan.queryState}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <StatusBadge status={activeScan.status} />
                      <div className="mt-1 font-mono text-[10px] text-[#64748B]">
                        {results.length} {results.length === 1 ? 'property' : 'properties'} found
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
                    <PropertyRow
                      key={`${p.property.parcelId}-${p.property.source}`}
                      profile={p}
                      onOpen={() => setOpenProfile(p)}
                    />
                  ))}
                </ul>
              )}
              {activeScan?.status === 'completed' && results.length === 0 && (
                <div className="rounded border border-[#0D2235] bg-black/30 px-4 py-8 text-center font-mono text-[11px] text-[#64748B]">
                  Scan complete — no distressed properties matched.
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

// ─── New-scan button + modal ──────────────────────────────────────────────

function NewScanButton({ onScanCreated }: { onScanCreated: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded px-4 py-2 text-[10px] font-black tracking-widest text-[#020D14]"
        style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' }}
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
        <div className="text-[10px] font-bold tracking-[0.3em] text-[#F59E0B]">START SCANNING</div>
        <h2 className="mt-2 text-2xl font-black">Find distressed properties anywhere in the US.</h2>
        <p className="mt-3 text-sm text-[#94A3B8]">
          Enter an address, city, county, ZIP, or state. We&apos;ll query 8 federal REO databases —
          HUD, Fannie Mae, Freddie Mac, VA, USDA, IRS, US Marshals, GSA — and return every
          distressed property we find with foreclosure, tax, and lien data.
        </p>
        <button
          onClick={() => setOpen(true)}
          className="mt-6 inline-block rounded px-6 py-3 text-sm font-black tracking-widest text-[#020D14]"
          style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' }}
        >
          RUN YOUR FIRST SCAN →
        </button>
        <div className="mt-4 font-mono text-[10px] text-[#475569]">
          Scans take 30 seconds to ~5 minutes depending on scope.
        </div>
      </div>
      {open && <ScanModal onClose={() => setOpen(false)} onScanCreated={(id) => { setOpen(false); onScanCreated(id) }} />}
    </div>
  )
}

function ScanModal({ onClose, onScanCreated }: { onClose: () => void; onScanCreated: (id: string) => void }) {
  const [queryType, setQueryType] = useState<ScanQueryType>('city')
  const [queryValue, setQueryValue] = useState('')
  const [queryState, setQueryState] = useState('')
  const [sourceFilter, setSourceFilter] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allSelected = sourceFilter.length === 0

  async function submit() {
    setSubmitting(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        queryType,
        queryValue: queryValue.trim(),
      }
      if (queryState.trim()) body.queryState = queryState.trim().toUpperCase()
      if (sourceFilter.length > 0) body.sourceFilter = sourceFilter

      const r = await fetch('/api/residential/scan', {
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
      <div className="w-full max-w-lg rounded-lg border border-[#F59E0B]/40 bg-[#08070a] p-6">
        <div className="text-[10px] font-bold tracking-[0.3em] text-[#F59E0B]">NEW DISTRESS SCAN</div>
        <h3 className="mt-1 text-xl font-black">Search across federal REO databases</h3>

        <div className="mt-4">
          <div className="text-[10px] font-bold tracking-widest text-[#475569]">SEARCH TYPE</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {(['address', 'city', 'county', 'zip', 'state'] as ScanQueryType[]).map((t) => (
              <button
                key={t}
                onClick={() => setQueryType(t)}
                className="rounded border px-3 py-1.5 text-[10px] font-bold tracking-widest"
                style={{
                  borderColor: queryType === t ? '#F59E0B' : '#0D2235',
                  background: queryType === t ? '#F59E0B12' : 'transparent',
                  color: queryType === t ? '#F59E0B' : '#94A3B8',
                }}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <label className="text-[10px] font-bold tracking-widest text-[#475569]">
            {queryType === 'address' && 'STREET ADDRESS'}
            {queryType === 'city' && 'CITY NAME'}
            {queryType === 'county' && 'COUNTY NAME'}
            {queryType === 'zip' && 'ZIP CODE'}
            {queryType === 'state' && 'STATE (2-LETTER)'}
          </label>
          <input
            type="text"
            value={queryValue}
            onChange={(e) => setQueryValue(e.target.value)}
            autoFocus
            placeholder={
              queryType === 'address' ? '123 Main St, Charlotte, NC' :
              queryType === 'city' ? 'Charlotte' :
              queryType === 'county' ? 'Mecklenburg' :
              queryType === 'zip' ? '28204' : 'NC'
            }
            className="mt-1 w-full rounded border border-[#0D2235] bg-black/60 px-3 py-2 text-sm text-white placeholder-[#334155] outline-none focus:border-[#F59E0B]"
          />
        </div>

        {(queryType === 'city' || queryType === 'county' || queryType === 'zip') && (
          <div className="mt-3">
            <label className="text-[10px] font-bold tracking-widest text-[#475569]">
              STATE FILTER (OPTIONAL)
            </label>
            <input
              type="text"
              value={queryState}
              onChange={(e) => setQueryState(e.target.value.toUpperCase().slice(0, 2))}
              maxLength={2}
              placeholder="NC"
              className="mt-1 w-32 rounded border border-[#0D2235] bg-black/60 px-3 py-2 text-sm uppercase text-white placeholder-[#334155] outline-none focus:border-[#F59E0B]"
            />
          </div>
        )}

        <div className="mt-4">
          <div className="flex items-baseline justify-between">
            <div className="text-[10px] font-bold tracking-widest text-[#475569]">
              DATA SOURCES {allSelected ? '(ALL)' : `(${sourceFilter.length} SELECTED)`}
            </div>
            {!allSelected && (
              <button
                onClick={() => setSourceFilter([])}
                className="font-mono text-[10px] text-[#F59E0B] hover:underline"
              >
                use all
              </button>
            )}
          </div>
          <div className="mt-1 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {ALL_SOURCES.map((s) => {
              const selected = sourceFilter.includes(s) || allSelected
              return (
                <button
                  key={s}
                  onClick={() => toggleSource(s)}
                  className="rounded border px-2 py-1.5 text-left text-[10px]"
                  style={{
                    borderColor: selected ? '#F59E0B40' : '#0D2235',
                    background: selected ? '#F59E0B0C' : 'transparent',
                    color: selected ? '#F59E0B' : '#475569',
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
            style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' }}
          >
            {submitting ? 'STARTING…' : 'RUN SCAN →'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Active-scan progress ─────────────────────────────────────────────────

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
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #F59E0B, #FBBF24)' }}
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
                info.status === 'running' ? '#F59E0B60' :
                info.status === 'failed' ? '#EF444460' :
                '#0D2235',
              color:
                info.status === 'done' ? '#22C55E' :
                info.status === 'running' ? '#F59E0B' :
                info.status === 'failed' ? '#EF4444' :
                '#475569',
              background:
                info.status === 'done' ? '#22C55E0C' :
                info.status === 'running' ? '#F59E0B0C' :
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
    status === 'running' ? '#F59E0B' :
    status === 'pending' ? '#94A3B8' :
    status === 'failed' ? '#EF4444' : '#475569'
  return (
    <span
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{
        background: color,
        boxShadow: status === 'running' ? `0 0 8px ${color}` : 'none',
        animation: status === 'running' ? 'pulse 1.5s ease-in-out infinite' : 'none',
      }}
    />
  )
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === 'completed' ? '#22C55E' :
    status === 'running' ? '#F59E0B' :
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

// ─── Property row + drawer (preserved from previous demo, types updated) ─

function PropertyRow({ profile, onOpen }: { profile: DistressProfile; onOpen: () => void }) {
  const { property, owner, distressScore, signals, foreclosure } = profile
  const scoreColor = distressScore >= 80 ? '#EF4444' : distressScore >= 50 ? '#F59E0B' : distressScore >= 20 ? '#FBBF24' : '#22C55E'
  return (
    <li>
      <button
        onClick={onOpen}
        className="flex w-full items-center gap-4 rounded border border-[#0D2235] bg-black/30 px-4 py-3 text-left transition hover:border-[#F59E0B]"
      >
        <div className="shrink-0 text-center">
          <div className="text-2xl font-black" style={{ color: scoreColor }}>
            {distressScore}
          </div>
          <div className="font-mono text-[8px] tracking-widest text-[#475569]">DISTRESS</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="truncate text-sm font-black">{property.address}</h3>
            <span className="font-mono text-[10px] text-[#64748B]">
              {property.city ? `${property.city}, ` : ''}{property.state}{property.zip ? ` ${property.zip}` : ''}
            </span>
          </div>
          <div className="mt-0.5 truncate text-[11px] text-[#94A3B8]">
            {owner ? (
              <>
                {owner.name} <span className="text-[#475569]">({owner.ownerType})</span>
              </>
            ) : (
              <span className="text-[#475569]">Owner unknown</span>
            )}
            {property.assessedValue ? ` · assessed ${formatCurrency(property.assessedValue)}` : ''}
            {property.listPrice ? ` · listed ${formatCurrency(property.listPrice)}` : ''}
            {property.yearBuilt ? ` · built ${property.yearBuilt}` : ''}
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <span className="rounded border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-2 py-0.5 text-[9px] font-bold tracking-widest text-[#F59E0B]">
              {property.source}
            </span>
            {foreclosure && (
              <span
                className="rounded px-2 py-0.5 text-[9px] font-bold tracking-widest"
                style={{ background: stageColor(foreclosure.stage), color: '#020D14' }}
              >
                {stageLabel(foreclosure.stage).toUpperCase()}
              </span>
            )}
            {signals.map((s, i) => (
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

function ProfileDrawer({ profile, onClose }: { profile: DistressProfile; onClose: () => void }) {
  const { property, owner, tax, liens, foreclosure, distressScore } = profile
  const totalOwed = tax.reduce((acc, t) => acc + Math.max(0, t.amountDue - t.amountPaid + (t.penalty || 0) + (t.interest || 0)), 0)
  const totalLiens = liens.filter((l) => l.status === 'active').reduce((a, l) => a + l.amount, 0)

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-[#F59E0B]/40 bg-[#020D14] sm:rounded-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-[#0D2235] bg-[#020D14] px-5 py-3">
          <div>
            <div className="text-[10px] font-bold tracking-[0.3em] text-[#F59E0B]">
              {property.source} · {property.parcelId}
            </div>
            <h2 className="text-lg font-black">{property.address}</h2>
            <div className="font-mono text-[10px] text-[#64748B]">
              {property.city ? `${property.city}, ` : ''}{property.state}{property.zip ? ` ${property.zip}` : ''}
              {property.county ? ` · ${property.county} County` : ''}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded border border-[#0D2235] px-2 py-1 text-[10px] font-bold tracking-widest text-[#94A3B8] hover:border-[#F59E0B] hover:text-[#F59E0B]"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded border border-[#0D2235] bg-black/40 p-3">
              <div className="text-[9px] font-bold tracking-widest text-[#475569]">DISTRESS</div>
              <div className="mt-1 text-3xl font-black" style={{ color: distressScore >= 50 ? '#EF4444' : '#F59E0B' }}>
                {distressScore}
              </div>
            </div>
            <div className="rounded border border-[#0D2235] bg-black/40 p-3">
              <div className="text-[9px] font-bold tracking-widest text-[#475569]">
                {property.listPrice ? 'LIST PRICE' : 'ASSESSED'}
              </div>
              <div className="mt-1 text-lg font-black">
                {property.listPrice ? formatCurrency(property.listPrice) :
                 property.assessedValue ? formatCurrency(property.assessedValue) : '—'}
              </div>
            </div>
            <div className="rounded border border-[#0D2235] bg-black/40 p-3">
              <div className="text-[9px] font-bold tracking-widest text-[#475569]">YEAR / SQFT</div>
              <div className="mt-1 text-sm font-bold">
                {property.yearBuilt || '—'} · {property.sqFt ? `${property.sqFt.toLocaleString()} sqft` : '—'}
              </div>
            </div>
          </div>

          {/* Owner */}
          {owner && (
            <div className="mt-5">
              <div className="text-[10px] font-bold tracking-[0.3em] text-[#F59E0B]">OWNER</div>
              <div className="mt-1 rounded border border-[#0D2235] bg-black/30 p-3 text-sm">
                <div className="font-bold">{owner.name}</div>
                <div className="font-mono text-[10px] text-[#94A3B8]">
                  {owner.ownerType.toUpperCase()}
                  {owner.mailingAddress && ` · ${owner.mailingAddress}`}
                  {owner.mailingCity && `, ${owner.mailingCity}`}
                  {owner.mailingState && ` ${owner.mailingState}`}
                  {owner.mailingZip && ` ${owner.mailingZip}`}
                </div>
              </div>
            </div>
          )}

          {/* Foreclosure */}
          {foreclosure && (
            <div className="mt-5">
              <div className="text-[10px] font-bold tracking-[0.3em] text-[#F59E0B]">FORECLOSURE{foreclosure.caseNumber ? ` · ${foreclosure.caseNumber}` : ''}</div>
              <div className="mt-1 rounded border-2 p-3 text-sm" style={{ borderColor: stageColor(foreclosure.stage), background: `${stageColor(foreclosure.stage)}10` }}>
                <div className="font-bold" style={{ color: stageColor(foreclosure.stage) }}>{stageLabel(foreclosure.stage).toUpperCase()}</div>
                <div className="mt-1 font-mono text-[10px] text-[#94A3B8]">
                  {foreclosure.filedDate && `Filed ${foreclosure.filedDate}`}
                  {foreclosure.hearingDate && ` · Hearing ${foreclosure.hearingDate}`}
                  {foreclosure.saleDate && ` · Sale ${foreclosure.saleDate}`}
                  {foreclosure.trustee && ` · Trustee ${foreclosure.trustee}`}
                </div>
              </div>
            </div>
          )}

          {/* Tax history */}
          {tax.length > 0 && (
            <div className="mt-5">
              <div className="flex items-baseline justify-between">
                <div className="text-[10px] font-bold tracking-[0.3em] text-[#F59E0B]">TAX HISTORY</div>
                {totalOwed > 0 && (
                  <div className="font-mono text-[10px] text-[#EF4444]">
                    {formatCurrency(totalOwed)} owed
                  </div>
                )}
              </div>
              <ul className="mt-1 grid gap-1">
                {tax
                  .slice()
                  .sort((a, b) => b.taxYear - a.taxYear)
                  .map((t) => {
                    const owed = Math.max(0, t.amountDue - t.amountPaid)
                    return (
                      <li
                        key={`${t.parcelId}-${t.source}-${t.taxYear}`}
                        className="flex items-center justify-between rounded border border-[#0D2235] bg-black/30 px-3 py-1.5 text-xs"
                      >
                        <span className="font-mono text-[10px] text-[#94A3B8]">{t.taxYear}</span>
                        <span>
                          {formatCurrency(t.amountPaid)} <span className="text-[#475569]">/ {formatCurrency(t.amountDue)}</span>
                        </span>
                        <span className={owed > 0 ? 'font-mono text-[10px] text-[#EF4444]' : 'font-mono text-[10px] text-[#22C55E]'}>
                          {owed > 0 ? `+${formatCurrency(owed + (t.penalty || 0) + (t.interest || 0))} due` : 'paid'}
                        </span>
                      </li>
                    )
                  })}
              </ul>
            </div>
          )}

          {/* Liens */}
          {liens.length > 0 && (
            <div className="mt-5">
              <div className="flex items-baseline justify-between">
                <div className="text-[10px] font-bold tracking-[0.3em] text-[#F59E0B]">LIENS</div>
                {totalLiens > 0 && (
                  <div className="font-mono text-[10px] text-[#EF4444]">{formatCurrency(totalLiens)} active</div>
                )}
              </div>
              <ul className="mt-1 grid gap-1">
                {liens.map((l) => (
                  <li
                    key={l.id}
                    className="flex items-center justify-between gap-3 rounded border border-[#0D2235] bg-black/30 px-3 py-1.5 text-xs"
                  >
                    <span className="font-mono text-[10px] uppercase text-[#F59E0B]">{l.type}</span>
                    <span className="min-w-0 flex-1 truncate text-[#94A3B8]">{l.plaintiff || '—'}</span>
                    <span>{formatCurrency(l.amount)}</span>
                    <span className="font-mono text-[9px] text-[#475569]">{l.filingDate || ''}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Outreach links */}
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            {owner && (
              <a
                href={`/spy/app/sleuth?subject=${encodeURIComponent(owner.name)}`}
                className="rounded border border-[#C8A227] bg-[#C8A227]/10 px-3 py-2 text-center text-[10px] font-bold tracking-widest text-[#C8A227]"
              >
                🕵️ SLEUTH OWNER →
              </a>
            )}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.address + ' ' + (property.city || '') + ' ' + property.state)}`}
              target="_blank"
              rel="noreferrer"
              className="rounded border border-[#0D2235] bg-black/30 px-3 py-2 text-center text-[10px] font-bold tracking-widest text-[#94A3B8]"
            >
              📍 OPEN IN MAPS →
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

function UpgradeGate() {
  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-[#08070a] px-6 py-12 text-[#ede8d8]">
      <div className="max-w-md text-center">
        <Image
          src="/spy-logo/hyve-residential-logo.png"
          alt="Hyve Residential"
          width={1536}
          height={1024}
          className="mx-auto h-auto w-full max-w-sm"
          priority
        />
        <div className="mt-2 font-mono text-[11px] tracking-widest text-[#9e8a55]">
          NATIONWIDE DISTRESS INTEL · PRO
        </div>
        <p className="mt-5 text-sm leading-relaxed text-[#94A3B8]">
          Run unlimited <span className="text-white">distressed-property scans</span> across 8 federal REO databases —
          HUD, Fannie Mae, Freddie Mac, VA, USDA, IRS, US Marshals, GSA. Foreclosure pipeline, tax delinquencies,
          owner records, lien data — every scan, every state, every county.
        </p>

        <ul className="mt-6 grid gap-2 text-left text-xs text-[#94A3B8]">
          <li className="flex gap-2"><span className="text-[#F59E0B]">✓</span> 8 federal REO sources, nationwide coverage</li>
          <li className="flex gap-2"><span className="text-[#F59E0B]">✓</span> Search by address, city, county, ZIP, or state</li>
          <li className="flex gap-2"><span className="text-[#F59E0B]">✓</span> Foreclosure pipeline (filed → sale scheduled)</li>
          <li className="flex gap-2"><span className="text-[#F59E0B]">✓</span> Distress score 0–100 per property</li>
          <li className="flex gap-2"><span className="text-[#F59E0B]">✓</span> One-click cross-link to Sleuth on the owner</li>
          <li className="flex gap-2"><span className="text-[#F59E0B]">✓</span> Same data PropStream charges $200/mo for. Yours included.</li>
        </ul>

        <a
          href="/spy#pricing"
          className="mt-7 inline-block rounded px-6 py-3 text-sm font-black tracking-widest text-[#020D14]"
          style={{
            background: 'linear-gradient(135deg, #F59E0B, #FBBF24)',
            boxShadow: '0 0 60px -10px rgba(245,158,11,0.5)',
          }}
        >
          UPGRADE TO PRO →
        </a>
      </div>
    </main>
  )
}
