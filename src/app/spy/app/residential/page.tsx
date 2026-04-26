'use client'

// HYVE Residential — in-tab distressed-property intel web app.
//
// Replaces the previous "download Windows installer" gate with a fully
// browser-native experience built on the same data shapes as the desktop
// app's Pydantic models. See src/lib/residential.ts for the schema and
// sample data.
//
// Tabs (sub-views via local state, not separate routes — keeps URL clean):
//   - DASHBOARD: top-N distressed properties sorted by distress score
//   - FORECLOSURES: filtered foreclosure pipeline view
//   - TAX DELINQUENT: properties with unpaid taxes
//   - LIENS: HOA / mechanic / judgment liens
//   - PROFILE: drill-down per property when a row is clicked
//
// Pro tier gate via hyve_spy_tier=pro cookie (set by /api/spy/verify-session
// when the user's active sub uses STRIPE_SPY_PRO_PRICE_ID or the annual one).

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import {
  loadDistressProfiles,
  formatCurrency,
  stageLabel,
  stageColor,
  type DistressProfile,
} from '@/lib/residential'

type Tab = 'dashboard' | 'foreclosures' | 'tax' | 'liens'

export default function ResidentialPage() {
  const [tier, setTier] = useState<'pro' | 'basic' | null>(null)
  const [tab, setTab] = useState<Tab>('dashboard')
  const [query, setQuery] = useState('')
  const [countyFilter, setCountyFilter] = useState<string>('all')
  const [openProfile, setOpenProfile] = useState<DistressProfile | null>(null)

  useEffect(() => {
    const m = document.cookie.match(/(?:^|; )hyve_spy_tier=([^;]+)/)
    setTier(m && m[1] === 'pro' ? 'pro' : 'basic')
  }, [])

  const profiles = useMemo(() => loadDistressProfiles(), [])

  const counties = useMemo(
    () => Array.from(new Set(profiles.map((p) => p.property.county))).sort(),
    [profiles],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return profiles.filter((p) => {
      if (countyFilter !== 'all' && p.property.county !== countyFilter) return false
      if (q) {
        const hay = [
          p.property.address,
          p.property.city,
          p.property.parcelId,
          p.owner.name,
          p.owner.mailingAddress,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      // Tab-specific filters
      if (tab === 'foreclosures' && !p.foreclosure) return false
      if (tab === 'tax' && p.tax.every((t) => t.amountDue <= t.amountPaid)) return false
      if (tab === 'liens' && p.liens.filter((l) => l.status === 'active').length === 0) return false
      return true
    })
  }, [profiles, query, countyFilter, tab])

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
          <div className="flex items-center gap-3">
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
                {profiles.length} properties · {counties.length} counties · sample data
              </div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Address, owner, parcel…"
              className="rounded border border-[#0D2235] bg-black/60 px-3 py-1.5 text-xs text-white placeholder-[#334155] outline-none focus:border-[#F59E0B]"
            />
            <select
              value={countyFilter}
              onChange={(e) => setCountyFilter(e.target.value)}
              className="rounded border border-[#0D2235] bg-black/60 px-2 py-1.5 text-xs text-white focus:border-[#F59E0B]"
            >
              <option value="all">All counties</option>
              {counties.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-3">
          {(
            [
              { id: 'dashboard', label: '🏘 ALL DISTRESS', count: profiles.length },
              { id: 'foreclosures', label: '🏛 FORECLOSURES', count: profiles.filter((p) => p.foreclosure).length },
              { id: 'tax', label: '💸 TAX DELINQUENT', count: profiles.filter((p) => p.tax.some((t) => t.amountDue > t.amountPaid)).length },
              { id: 'liens', label: '⛓ LIENS', count: profiles.filter((p) => p.liens.some((l) => l.status === 'active')).length },
            ] as const
          ).map((t) => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="shrink-0 rounded border px-3 py-1 text-[10px] font-bold tracking-widest transition"
                style={{
                  borderColor: active ? '#F59E0B' : '#0D2235',
                  background: active ? '#F59E0B1F' : 'transparent',
                  color: active ? '#F59E0B' : '#64748B',
                }}
              >
                {t.label} <span className="opacity-70">({t.count})</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 pt-4">
        <div className="mb-2 font-mono text-[10px] text-[#475569]">
          Showing {filtered.length} of {profiles.length} · sorted by distress score (desc)
        </div>
        <ul className="grid gap-2">
          {filtered.map((p) => (
            <PropertyRow key={p.property.parcelId} profile={p} onOpen={() => setOpenProfile(p)} />
          ))}
          {filtered.length === 0 && (
            <li className="rounded border border-[#0D2235] bg-black/30 px-4 py-8 text-center font-mono text-[11px] text-[#64748B]">
              No matches. Try a different filter.
            </li>
          )}
        </ul>
      </div>

      {/* Sample-data banner — replaced when Supabase scraper output is wired */}
      <div className="mx-auto mt-8 max-w-6xl px-4">
        <div className="rounded border border-[#0D2235] bg-black/30 px-4 py-3 text-[11px] text-[#64748B]">
          <strong className="text-[#F59E0B]">Demo dataset:</strong> 6 sample distress profiles across Wake & Mecklenburg counties.
          Phase 2 wires the same UI to live Supabase tables populated by scheduled scrapers (Wake County, Mecklenburg County, then nationwide).
          Schema in <code className="rounded bg-black px-1 text-[#F59E0B]">src/lib/residential.ts</code> already matches what the Python engine produces.
        </div>
      </div>

      {openProfile && <ProfileDrawer profile={openProfile} onClose={() => setOpenProfile(null)} />}
    </main>
  )
}

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
              {property.city}, {property.state} · {property.county} Co · {property.parcelId}
            </span>
          </div>
          <div className="mt-0.5 truncate text-[11px] text-[#94A3B8]">
            {owner.name} <span className="text-[#475569]">({owner.ownerType})</span>
            {property.assessedValue ? ` · assessed ${formatCurrency(property.assessedValue)}` : ''}
            {property.yearBuilt ? ` · built ${property.yearBuilt}` : ''}
            {property.sqFt ? ` · ${property.sqFt.toLocaleString()} sqft` : ''}
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
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
        <div className="shrink-0 text-2xl text-[#475569] transition group-hover:text-[#F59E0B]">→</div>
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
              PROPERTY PROFILE · {property.parcelId}
            </div>
            <h2 className="text-lg font-black">{property.address}</h2>
            <div className="font-mono text-[10px] text-[#64748B]">
              {property.city}, {property.state} {property.zip} · {property.county} County
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
              <div className="text-[9px] font-bold tracking-widest text-[#475569]">ASSESSED</div>
              <div className="mt-1 text-lg font-black">{property.assessedValue ? formatCurrency(property.assessedValue) : '—'}</div>
            </div>
            <div className="rounded border border-[#0D2235] bg-black/40 p-3">
              <div className="text-[9px] font-bold tracking-widest text-[#475569]">YEAR / SQFT</div>
              <div className="mt-1 text-sm font-bold">
                {property.yearBuilt || '—'} · {property.sqFt ? `${property.sqFt.toLocaleString()} sqft` : '—'}
              </div>
            </div>
          </div>

          {/* Owner */}
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

          {/* Foreclosure */}
          {foreclosure && (
            <div className="mt-5">
              <div className="text-[10px] font-bold tracking-[0.3em] text-[#F59E0B]">FORECLOSURE · {foreclosure.caseNumber}</div>
              <div className="mt-1 rounded border-2 p-3 text-sm" style={{ borderColor: stageColor(foreclosure.stage), background: `${stageColor(foreclosure.stage)}10` }}>
                <div className="font-bold" style={{ color: stageColor(foreclosure.stage) }}>{stageLabel(foreclosure.stage).toUpperCase()}</div>
                <div className="mt-1 font-mono text-[10px] text-[#94A3B8]">
                  Filed {foreclosure.filedDate}
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
                        key={`${t.parcelId}-${t.taxYear}`}
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
                    <span className="min-w-0 flex-1 truncate text-[#94A3B8]">{l.plaintiff}</span>
                    <span>{formatCurrency(l.amount)}</span>
                    <span className="font-mono text-[9px] text-[#475569]">{l.filingDate}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Outreach */}
          <div className="mt-6 grid gap-2 sm:grid-cols-3">
            <button
              onClick={() => alert('Word doc generation comes online when scrapers are wired in Phase 2 — uses python-docx server-side via the same templates as the desktop app.')}
              className="rounded border border-[#F59E0B] bg-[#F59E0B]/10 px-3 py-2 text-[10px] font-bold tracking-widest text-[#F59E0B]"
            >
              📄 CASH OFFER
            </button>
            <button
              onClick={() => alert('Lien-negotiation memo coming in Phase 2.')}
              className="rounded border border-[#F59E0B] bg-[#F59E0B]/10 px-3 py-2 text-[10px] font-bold tracking-widest text-[#F59E0B]"
            >
              📄 LIEN MEMO
            </button>
            <a
              href={`/spy/app/sleuth?subject=${encodeURIComponent(owner.name)}`}
              className="rounded border border-[#C8A227] bg-[#C8A227]/10 px-3 py-2 text-center text-[10px] font-bold tracking-widest text-[#C8A227]"
            >
              🕵️ SLEUTH OWNER →
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
          DISTRESSED-PROPERTY INTEL · IN-TAB · PRO
        </div>
        <p className="mt-5 text-sm leading-relaxed text-[#94A3B8]">
          Browse <span className="text-white">every distressed property</span> in your county — foreclosures (filed → sale scheduled), tax delinquencies (years owed),
          HOA / mechanic / judgment liens — with a per-property profile, distress score, and one-click outreach docs.
          Lives inside the Spy app. No download.
        </p>

        <ul className="mt-6 grid gap-2 text-left text-xs text-[#94A3B8]">
          <li className="flex gap-2"><span className="text-[#F59E0B]">✓</span> Foreclosure pipeline (filed → notice → sale → sold)</li>
          <li className="flex gap-2"><span className="text-[#F59E0B]">✓</span> Tax-delinquent properties (years owed, amount due)</li>
          <li className="flex gap-2"><span className="text-[#F59E0B]">✓</span> HOA / mechanic / contractor / judgment liens</li>
          <li className="flex gap-2"><span className="text-[#F59E0B]">✓</span> Distress score 0-100 per property</li>
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
