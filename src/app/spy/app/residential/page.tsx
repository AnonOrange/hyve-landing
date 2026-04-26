'use client'

// HYVE Residential — distressed-property intelligence for real estate
// investors. PyQt6 + SQLAlchemy + Playwright desktop app (~195MB Windows
// installer), so we can't iframe it like Sleuth — this page is a pro-gated
// download portal with system requirements + quick-start guide.
//
// Hosting: the installer .exe is too big for Vercel public/ (100MB limit).
// We pull the download URL from NEXT_PUBLIC_RESIDENTIAL_DOWNLOAD_URL so
// the operator can host on GitHub Releases / Supabase Storage / R2 / etc.
// without code changes. If unset we surface a "coming soon" state.
//
// Pro gate: same cookie pattern as Sleuth. `hyve_spy_tier=pro` cookie
// → grants access. Anything else → upgrade prompt.

import { useEffect, useState } from 'react'

const DOWNLOAD_URL = process.env.NEXT_PUBLIC_RESIDENTIAL_DOWNLOAD_URL || ''
const VERSION = process.env.NEXT_PUBLIC_RESIDENTIAL_VERSION || 'v0.1.0'

export default function ResidentialPage() {
  const [tier, setTier] = useState<'pro' | 'basic' | null>(null)

  useEffect(() => {
    const m = document.cookie.match(/(?:^|; )hyve_spy_tier=([^;]+)/)
    setTier(m && m[1] === 'pro' ? 'pro' : 'basic')
  }, [])

  if (tier === null) {
    return (
      <main className="flex h-screen w-full items-center justify-center bg-[#020D14] text-[#94A3B8]">
        <div className="font-mono text-xs">checking access…</div>
      </main>
    )
  }

  if (tier !== 'pro') {
    return <UpgradeGate />
  }

  return (
    <main className="min-h-screen bg-[#020D14] pb-32 text-[#E2E8F0]">
      <div
        className="sticky top-0 z-20 border-b border-[#0D2235] bg-[#020D14]/95 backdrop-blur"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-base">🏚️</span>
            <div>
              <div className="text-[10px] font-black tracking-[0.4em] text-[#F59E0B]">HYVE RESIDENTIAL</div>
              <div className="font-mono text-[10px] text-[#64748B]">
                Distressed-property intel · desktop · pro
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 pt-12">
        <h1 className="text-4xl font-black md:text-5xl">
          Find every <span style={{ color: '#F59E0B' }}>distressed property</span> in your county.
        </h1>
        <p className="mt-5 text-lg text-[#94A3B8]">
          A self-hosted real-estate intel app that auto-scrapes county records and surfaces every
          distress signal an investor cares about — foreclosures, tax delinquencies, HOA liens,
          mechanic liens, judgments — into one searchable interface with property-profile cards
          and pre-formatted outreach documents.
        </p>

        {/* Download CTA */}
        <div className="mt-10 rounded-xl border border-[#F59E0B]/40 bg-[#F59E0B]/5 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[10px] font-bold tracking-[0.3em] text-[#F59E0B]">WINDOWS INSTALLER · {VERSION.toUpperCase()}</div>
              <div className="mt-1 text-xl font-black">HYVEResidential_Setup.exe</div>
              <div className="mt-1 font-mono text-[11px] text-[#64748B]">
                ~195MB · Windows 10+ (64-bit) · includes scrapers + SQLite DB
              </div>
            </div>
            {DOWNLOAD_URL ? (
              <a
                href={DOWNLOAD_URL}
                download
                className="shrink-0 rounded px-6 py-3 text-sm font-black tracking-widest text-[#020D14]"
                style={{
                  background: 'linear-gradient(135deg, #F59E0B, #FBBF24)',
                  boxShadow: '0 0 60px -10px rgba(245,158,11,0.5)',
                }}
              >
                ⬇ DOWNLOAD
              </a>
            ) : (
              <div className="shrink-0 rounded border border-[#0D2235] bg-black/40 px-4 py-3 text-center font-mono text-[10px] text-[#64748B]">
                build pending
                <br />
                <span className="text-[8px]">operator setup required</span>
              </div>
            )}
          </div>
          {!DOWNLOAD_URL && (
            <div className="mt-4 rounded bg-black/40 px-3 py-2 text-[11px] text-[#94A3B8]">
              Set <code className="rounded bg-black px-1 text-[#F59E0B]">NEXT_PUBLIC_RESIDENTIAL_DOWNLOAD_URL</code> in Vercel env to publish the installer.
              Recommended host: GitHub Releases (no size cap, works for anyone with a free GitHub account).
            </div>
          )}
        </div>

        {/* Feature grid */}
        <div className="mt-12">
          <h2 className="text-2xl font-black">What it indexes</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              {
                title: 'Foreclosure pipeline',
                emoji: '🏛',
                body: 'Filed → Notice of Hearing → Hearing Scheduled → Sale Scheduled → Sold/Dismissed. Every stage timestamped, deduped across county sites, and indexed for full-text search.',
              },
              {
                title: 'Tax-delinquent properties',
                emoji: '💸',
                body: 'Years owed, principal due, penalty + interest, payment history. Filter by county, owed-amount range, or how delinquent (1yr, 2-3yr, 3yr+).',
              },
              {
                title: 'HOA + mechanic + judgment liens',
                emoji: '⛓',
                body: 'Encumbrances on title that signal financial stress. Type, amount, plaintiff, filing date — sortable, exportable to CSV.',
              },
              {
                title: 'Property profiles',
                emoji: '🏘',
                body: 'Combined view per parcel: owner record + assessed value + zoning + acreage + sq ft + tax history + every lien + foreclosure status. One screen.',
              },
              {
                title: 'Auto-scheduled scrapers',
                emoji: '🤖',
                body: 'APScheduler runs Playwright-based scrapers nightly per county adapter (Wake, Mecklenburg, more). New filings appear in your DB by morning.',
              },
              {
                title: 'Outreach document generator',
                emoji: '📄',
                body: 'Pre-formatted Word docs: cash-offer letter, lien-negotiation memo, owner-finance proposal. Auto-fills owner name, property, parcel, owed amounts.',
              },
            ].map((f) => (
              <div key={f.title} className="rounded-lg border border-[#0D2235] bg-black/30 p-5">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{f.emoji}</span>
                  <h3 className="font-black">{f.title}</h3>
                </div>
                <p className="mt-2 text-sm text-[#94A3B8]">{f.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Why self-hosted */}
        <div className="mt-12 rounded-lg border border-[#0D2235] bg-black/40 p-6">
          <div className="text-[10px] font-bold tracking-[0.3em] text-[#22C55E]">VS PROPSTREAM / DEALMACHINE / BATCHLEADS</div>
          <h3 className="mt-1 text-xl font-black">$0/month vs $200-1,000/month</h3>
          <p className="mt-3 text-sm text-[#94A3B8]">
            Commercial distress-data aggregators charge a monthly subscription for what is fundamentally public-record data. HYVE Residential ships you the same data layer (foreclosures + tax delinquencies + liens) by running scrapers locally on your machine. Your county's public records, in a private SQLite database that never leaves your laptop. No subscription. No upload of your leads to a SaaS. No data handed off to anyone.
          </p>
        </div>

        {/* System requirements */}
        <div className="mt-10">
          <h2 className="text-2xl font-black">System requirements</h2>
          <ul className="mt-4 space-y-2 text-sm text-[#94A3B8]">
            <li className="flex gap-3"><span className="text-[#F59E0B]">·</span> Windows 10 or 11 (64-bit)</li>
            <li className="flex gap-3"><span className="text-[#F59E0B]">·</span> 500MB free disk space (app + database growth)</li>
            <li className="flex gap-3"><span className="text-[#F59E0B]">·</span> Internet connection for scheduled scrapers (no constant connection needed)</li>
            <li className="flex gap-3"><span className="text-[#F59E0B]">·</span> No Python install required (PyInstaller bundles everything)</li>
          </ul>
        </div>

        {/* Quick start */}
        <div className="mt-10">
          <h2 className="text-2xl font-black">Quick start</h2>
          <ol className="mt-4 space-y-3 text-sm text-[#94A3B8]">
            <li>
              <span className="font-bold text-white">1.</span> Download <span className="font-mono text-[#F59E0B]">HYVEResidential_Setup.exe</span> above.
            </li>
            <li>
              <span className="font-bold text-white">2.</span> Run the installer. Windows SmartScreen may flag it (unsigned executable) — click "More info" → "Run anyway".
            </li>
            <li>
              <span className="font-bold text-white">3.</span> Launch HYVE Residential from the Start menu. The first run initializes the SQLite database and registers county adapters (Wake, Mecklenburg, etc.).
            </li>
            <li>
              <span className="font-bold text-white">4.</span> Open Settings → Counties → enable the counties you operate in. Scrapers will run on the configured schedule (default: nightly at 2 AM local).
            </li>
            <li>
              <span className="font-bold text-white">5.</span> Use the Search view to filter by distress type, address, or owner. Click any property to open its profile + generate outreach documents.
            </li>
          </ol>
        </div>

        <div className="mt-12 rounded border border-[#0D2235] bg-black/30 px-4 py-3 text-[11px] text-[#64748B]">
          <strong className="text-[#F59E0B]">Disclaimer:</strong> HYVE Residential indexes public-record data published by county governments. Always verify
          a property's current status with the source county registry before making an offer or sending mail. Scraped data may lag the live registry by up to 24 hours.
        </div>
      </div>
    </main>
  )
}

function UpgradeGate() {
  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-[#020D14] px-6 py-12 text-[#E2E8F0]">
      <div className="max-w-md text-center">
        <div className="text-5xl">🏚️</div>
        <h1 className="mt-4 text-3xl font-black">
          HYVE <span style={{ color: '#F59E0B' }}>Residential</span>
        </h1>
        <div className="mt-2 font-mono text-[11px] tracking-widest text-[#64748B]">
          DISTRESSED-PROPERTY INTEL · DESKTOP · PRO
        </div>
        <p className="mt-5 text-sm leading-relaxed text-[#94A3B8]">
          A self-hosted desktop app that auto-scrapes <span className="text-white">county property records</span> and
          surfaces every distress signal investors care about — foreclosures, tax delinquencies, HOA liens,
          mechanic liens, judgments — with property-profile cards and outreach document generation.
        </p>

        <ul className="mt-6 grid gap-2 text-left text-xs text-[#94A3B8]">
          <li className="flex gap-2"><span className="text-[#F59E0B]">✓</span> Foreclosure pipeline (filed → sale scheduled → sold)</li>
          <li className="flex gap-2"><span className="text-[#F59E0B]">✓</span> Tax-delinquent properties (years owed, amount due)</li>
          <li className="flex gap-2"><span className="text-[#F59E0B]">✓</span> HOA / mechanic / contractor / judgment liens</li>
          <li className="flex gap-2"><span className="text-[#F59E0B]">✓</span> Property profiles with full owner + tax + lien history</li>
          <li className="flex gap-2"><span className="text-[#F59E0B]">✓</span> Auto-generated cash-offer / lien-negotiation Word docs</li>
          <li className="flex gap-2"><span className="text-[#F59E0B]">✓</span> Same data PropStream charges $200/mo for. Yours, $0/mo.</li>
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
