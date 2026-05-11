// /caseline — Hyve CaseLine product page.
// Tactical case-analysis workspace for law firms.
// Cyan accent (#00B4D8) — matches the desktop app's "Nexus" default theme.

import Image from 'next/image'
import Link from 'next/link'

export const metadata = {
  title: 'Hyve CaseLine — Tactical workspace for law firms',
  description:
    'Case management, OSINT (Skips), legal drafting, federal sentencing math, deadline calendars, trial notebook, and CaSeY — a local AI assistant that never phones home. Desktop installer + optional on-premises server with local LLM. From $999/year for 5 seats.',
}

const ACCENT = '#00B4D8'

type Feature = { title: string; body: string }

const FEATURES: Feature[] = [
  {
    title: 'CaSeY — local AI',
    body: 'Curated legal knowledge base across all major practice areas + optional in-browser LLM (Llama 3, Phi-3) or firm-server LLM via Ollama. Voice in, voice out. "Hey CaSeY" wake word. No queries to external AI, ever.',
  },
  {
    title: 'LIVE TRIAL mode',
    body: 'Continuous speech recognition with ~30 objection-trigger patterns. Pops the right objection name, rationale, authority, and verbatim prompt the moment your opponent says the trigger words.',
  },
  {
    title: 'Federal sentencing math',
    body: 'USSG 2024 grid baked in. Offense level + criminal history → guideline range, zone, mandatory-minimum flags, ACCA + Career Offender effects. Real-time recalculation as you adjust inputs.',
  },
  {
    title: 'Deadline calculator',
    body: 'Trigger events compute every downstream federal deadline automatically — Speedy Trial Act 70-day, AEDPA 1-year, FRAP 4(b) appeals, FRCrP discovery, notice deadlines. Pulsing topbar countdown.',
  },
  {
    title: 'Trial Notebook',
    body: 'Witnesses (with examination outlines), exhibits (marked / admitted / excluded), motions in limine, voir dire, opening / closing. Mark live as the trial unfolds.',
  },
  {
    title: 'OSINT — SKIPS',
    body: '110+ curated tools across People, Phone, Social, Court, Vehicle, Property, Dark Web, plus 15 documented field-investigation tactics. Search the whole catalog instantly.',
  },
  {
    title: 'Drafting + PDF import',
    body: '27+ legal templates auto-filled from firm profile + active case. Print-to-PDF with proper Letter-size, double-spaced legal formatting. Fill any AcroForm PDF (motions to suppress, FOIA, etc.).',
  },
  {
    title: 'Multi-case + sharing',
    body: 'Persistent named cases with linking, team members, export/import, and either Firebase cloud sync or an on-premises CaseLine Server hub.',
  },
  {
    title: 'Billable hours',
    body: 'Live timer per case, manual entries, hourly-rate × minutes math, billable/non-billable toggle, CSV export ready for QuickBooks/Clio.',
  },
  {
    title: 'Face Search',
    body: '12 curated facial-recognition services with one-click launch. Image stays in your browser. Legal-use disclaimer baked in (BIPA / GDPR awareness).',
  },
  {
    title: 'Audit log',
    body: 'Every login, case read/write/delete, firm-profile change, file upload, and LLM query is logged with timestamp + user + target. Supports ABA Model Rule 1.6 documentation.',
  },
  {
    title: 'Files & exhibits',
    body: 'Attach original PDFs, photos, audio, video to any case. Stored locally; synced to CaseLine Server or Firebase when configured. Open / download / delete from one panel.',
  },
]

type Tier = {
  name: string
  price: string
  seats: string
  best: string
  highlight?: boolean
  features: string[]
  cta: { label: string; href?: string; onClick?: string }
}

const TIERS: Tier[] = [
  {
    name: 'STARTER',
    price: '$999 / year',
    seats: '5 seats',
    best: 'Solo &amp; small firms',
    features: [
      'All desktop features',
      'Firebase cloud sync',
      'CaSeY local AI',
      'Live Trial mode',
      'Heavy Mode (in-browser LLM)',
      'Email support',
    ],
    cta: { label: 'BUY NOW', href: '/caseline/buy?tier=5' },
  },
  {
    name: 'FIRM',
    price: '$1,799 / year',
    seats: '10 seats',
    best: 'Mid-size firms',
    highlight: true,
    features: [
      'Everything in STARTER',
      'CaseLine Server (on-prem hub)',
      'Centralized LLM via Ollama',
      'Priority support',
      'Federal + state template packs',
      'Phone onboarding',
    ],
    cta: { label: 'BUY NOW', href: '/caseline/buy?tier=10' },
  },
  {
    name: 'ENTERPRISE',
    price: 'Custom',
    seats: '>10 seats — quote',
    best: 'Large firms &amp; legal aid',
    features: [
      'Everything in FIRM',
      'Custom seat counts',
      'Dedicated implementation engineer',
      'SLA-backed uptime',
      'Single sign-on integration',
      'On-prem LLM deployment',
    ],
    cta: { label: 'REQUEST QUOTE', href: 'mailto:sales@hyveapp.co?subject=Enterprise%20CaseLine%20quote' },
  },
]

export default function CaseLinePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#08070a] font-sans text-[#ede8d8]">
      {/* Honeycomb backdrop — same pattern as the umbrella homepage */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 100' fill='none' stroke='%23C8A227' stroke-width='1'><polygon points='28,2 54,16 54,46 28,60 2,46 2,16'/><polygon points='28,42 54,56 54,86 28,100 2,86 2,56'/></svg>\")",
          backgroundSize: '56px 100px',
        }}
      />

      {/* Cyan accent glow — distinguishes CaseLine pages from gold-themed Hyve */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] opacity-30"
        style={{
          background:
            'radial-gradient(ellipse at top, rgba(0,180,216,0.30), transparent 70%)',
        }}
      />

      {/* Header — back to Hyve + minimal product nav */}
      <header className="relative z-30 mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-6">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/hyve-logo/hyve-messenger-emblem.png"
            alt="Hyve"
            width={64}
            height={64}
            className="h-9 w-9"
            priority
          />
          <span
            className="text-sm font-black tracking-[0.3em]"
            style={{
              background: 'linear-gradient(135deg, #C8A227 0%, #E8C456 50%, #C8A227 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              color: 'transparent',
            }}
          >
            HYVE / CASELINE
          </span>
        </Link>
        <nav className="hidden gap-5 text-xs font-bold tracking-[0.2em] text-[#9e8a55] md:flex">
          <Link href="/" className="transition hover:text-[#E8C456]">← HYVE</Link>
          <a href="#features" className="transition hover:text-[#00B4D8]">FEATURES</a>
          <a href="#deploy"   className="transition hover:text-[#00B4D8]">DEPLOY</a>
          <a href="#pricing"  className="transition hover:text-[#00B4D8]">PRICING</a>
          <Link href="/caseline/buy" className="rounded border px-3 py-1" style={{ borderColor: ACCENT, color: ACCENT }}>
            BUY NOW
          </Link>
        </nav>
      </header>

      {/* HERO */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 py-16 text-center md:py-24">
        <div className="mx-auto mb-8 flex items-center justify-center">
          <Image
            src="/hyve-logo/hyve-caseline-emblem.png"
            alt="Hyve CaseLine"
            width={220}
            height={220}
            className="h-32 w-auto md:h-40"
            style={{ filter: `drop-shadow(0 0 26px ${ACCENT}aa)` }}
            priority
          />
        </div>
        <div className="font-mono text-[11px] tracking-[0.4em]" style={{ color: ACCENT }}>
          HYVE CASELINE · TACTICAL WORKSPACE FOR LAW FIRMS
        </div>
        <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">
          A courtroom feels tactical.{' '}
          <span
            style={{
              background: 'linear-gradient(120deg, #d4e8f0 0%, #00B4D8 70%, #d4e8f0 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              color: 'transparent',
            }}
          >
            Your software should too.
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[#9e8a55] md:text-lg">
          CaseLine is the case-analysis workspace lawyers actually need.
          Case management, OSINT, drafting, federal sentencing math, deadline
          calendars, trial notebook, and <strong className="text-[#ede8d8]">CaSeY</strong> — a local AI
          assistant that runs on your hardware. No third-party AI inference, ever.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/caseline/buy"
            className="rounded px-7 py-3 font-mono text-sm font-bold tracking-[0.3em] text-black transition hover:scale-[1.02]"
            style={{ background: ACCENT, boxShadow: `0 0 22px ${ACCENT}99` }}
          >
            BUY NOW
          </Link>
          <a
            href="#pricing"
            className="rounded border px-7 py-3 font-mono text-sm font-bold tracking-[0.3em] transition hover:bg-white/5"
            style={{ borderColor: ACCENT, color: ACCENT }}
          >
            SEE PRICING
          </a>
          <Link
            href="/caseline/download"
            className="rounded border px-7 py-3 font-mono text-sm font-bold tracking-[0.3em] text-[#9e8a55] transition hover:bg-white/5 hover:text-[#ede8d8]"
            style={{ borderColor: '#2a2135' }}
          >
            DOWNLOAD
          </Link>
        </div>
        <div className="mt-8 font-mono text-[11px] tracking-[0.3em] text-[#6b5e3a]">
          5 SEATS · $999 / YEAR · NATIVE WIN / MAC / LINUX
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="relative z-10 mx-auto max-w-7xl px-6 py-16">
        <div className="mb-12 text-center">
          <div className="font-mono text-[10px] tracking-[0.4em]" style={{ color: ACCENT }}>WHAT IT DOES</div>
          <h2 className="mt-2 text-3xl font-black md:text-4xl">
            Every tool a defender needs, in one workspace.
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border-2 p-5 transition hover:scale-[1.01]"
              style={{ borderColor: `${ACCENT}33`, background: `${ACCENT}08` }}
            >
              <h3 className="text-base font-black text-[#ede8d8]">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#9e8a55]">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* DEPLOY */}
      <section id="deploy" className="relative z-10 mx-auto max-w-7xl px-6 py-16">
        <div className="mb-12 text-center">
          <div className="font-mono text-[10px] tracking-[0.4em]" style={{ color: ACCENT }}>TWO WAYS TO DEPLOY</div>
          <h2 className="mt-2 text-3xl font-black md:text-4xl">Solo or firm hub. Your call.</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border-2 p-7" style={{ borderColor: '#2a2135', background: 'rgba(0,0,0,0.4)' }}>
            <div className="font-mono text-[11px] tracking-[0.3em] text-[#9e8a55]">SOLO / SMALL FIRM</div>
            <h3 className="mt-2 text-2xl font-black text-[#ede8d8]">Native desktop install</h3>
            <p className="mt-3 text-sm leading-relaxed text-[#9e8a55]">
              Install the CaseLine desktop app on each workstation. Firebase
              handles cross-machine sync. No infrastructure to manage.
            </p>
            <ul className="mt-5 space-y-2 text-sm">
              <li className="text-[#ede8d8]">▸ Native installer (Win .msi · macOS .dmg · Linux .AppImage)</li>
              <li className="text-[#ede8d8]">▸ Cloud sync via Hyve-hosted Firebase</li>
              <li className="text-[#ede8d8]">▸ Heavy Mode — in-browser LLM downloads on first use</li>
              <li className="text-[#ede8d8]">▸ Optional anonymous mode (local-only, no account)</li>
            </ul>
          </div>
          <div
            className="rounded-xl border-2 p-7"
            style={{ borderColor: `${ACCENT}99`, background: `${ACCENT}10`, boxShadow: `0 0 24px ${ACCENT}33` }}
          >
            <div className="font-mono text-[11px] tracking-[0.3em]" style={{ color: ACCENT }}>FIRM HUB</div>
            <h3 className="mt-2 text-2xl font-black text-[#ede8d8]">On-prem CaseLine Server</h3>
            <p className="mt-3 text-sm leading-relaxed text-[#9e8a55]">
              Install CaseLine Server on one central computer in the office.
              Workstations connect to it for case storage and LLM inference.
            </p>
            <ul className="mt-5 space-y-2 text-sm">
              <li className="text-[#ede8d8]">▸ SQLite + WebSocket sync — your network only</li>
              <li className="text-[#ede8d8]">▸ Centralized Ollama LLM — one 5–10 GB model, every seat queries it</li>
              <li className="text-[#ede8d8]">▸ Built-in audit log (ABA Rule 1.6 compliant)</li>
              <li className="text-[#ede8d8]">▸ Optional Firebase mirror for off-site backup</li>
            </ul>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="relative z-10 mx-auto max-w-7xl px-6 py-16">
        <div className="mb-12 text-center">
          <div className="font-mono text-[10px] tracking-[0.4em]" style={{ color: ACCENT }}>PRICING</div>
          <h2 className="mt-2 text-3xl font-black md:text-4xl">Annual subscription. All features included.</h2>
          <p className="mt-3 text-sm text-[#9e8a55]">No upgrade upsells. Every tier ships everything.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {TIERS.map((t) => (
            <div
              key={t.name}
              className="flex flex-col rounded-xl border-2 p-7"
              style={
                t.highlight
                  ? { borderColor: ACCENT, background: `${ACCENT}10`, boxShadow: `0 0 24px ${ACCENT}33` }
                  : { borderColor: '#2a2135', background: 'rgba(0,0,0,0.35)' }
              }
            >
              <div className="font-mono text-[11px] tracking-[0.3em]" style={{ color: t.highlight ? ACCENT : '#9e8a55' }}>
                {t.name}
              </div>
              <div className="mt-3 text-3xl font-black text-[#ede8d8]">{t.price}</div>
              <div className="mt-1 font-mono text-[11px] tracking-[0.2em] text-[#9e8a55]">{t.seats}</div>
              <div className="mt-2 text-xs italic text-[#6b5e3a]" dangerouslySetInnerHTML={{ __html: 'Best for: ' + t.best }} />
              <ul className="my-6 flex-1 space-y-2 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="text-[#ede8d8]">
                    <span style={{ color: ACCENT, fontWeight: 700, marginRight: 8 }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              {t.cta.href?.startsWith('mailto:') ? (
                <a
                  href={t.cta.href}
                  className="rounded px-5 py-3 text-center font-mono text-sm font-bold tracking-[0.25em] text-black transition hover:scale-[1.02]"
                  style={{ background: ACCENT, boxShadow: `0 0 16px ${ACCENT}99` }}
                >
                  {t.cta.label}
                </a>
              ) : (
                <Link
                  href={t.cta.href ?? '/caseline/buy'}
                  className="rounded px-5 py-3 text-center font-mono text-sm font-bold tracking-[0.25em] text-black transition hover:scale-[1.02]"
                  style={{ background: ACCENT, boxShadow: `0 0 16px ${ACCENT}99` }}
                >
                  {t.cta.label}
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 mt-10 border-t border-[#2a2135] bg-black/40">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <div className="mb-8 flex flex-col items-center gap-2 border-b border-[#2a2135] pb-6 text-center">
            <div className="font-mono text-[9px] tracking-[0.4em] text-[#6b5e3a]">CREATED BY</div>
            <p className="text-base font-bold tracking-[0.15em] text-[#ede8d8]">ANTHONY S. OWENS</p>
            <p className="text-[11px] text-[#9e8a55]">
              c/o{' '}
              <a
                href="https://www.vibesoftwaresolutions.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#E8C456] underline-offset-4 hover:underline"
              >
                Vibe Software Solutions
              </a>
            </p>
          </div>
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
            <div className="flex items-center gap-2">
              <Image
                src="/hyve-logo/hyve-caseline-emblem.png"
                alt="Hyve CaseLine"
                width={32}
                height={32}
                className="h-7 w-auto"
              />
              <span className="font-mono text-[10px] tracking-[0.3em] text-[#9e8a55]">© 2026 HYVE CASELINE</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-mono text-[10px] tracking-[0.2em] text-[#6b5e3a]">
              <Link href="/" className="hover:text-[#E8C456]">← HYVE</Link>
              <a href="#features" className="hover:text-[#00B4D8]">FEATURES</a>
              <a href="#pricing" className="hover:text-[#00B4D8]">PRICING</a>
              <Link href="/caseline/download" className="hover:text-[#00B4D8]">DOWNLOAD</Link>
              <Link href="/caseline/buy" className="hover:text-[#00B4D8]">BUY</Link>
              <Link href="/privacy" className="hover:text-[#E8C456]">PRIVACY</Link>
              <a href="mailto:sales@hyveapp.co" className="hover:text-[#E8C456]">SALES</a>
              <a href="mailto:support@hyveapp.co" className="hover:text-[#E8C456]">SUPPORT</a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
