// New umbrella homepage at / — the central showcase for every Hyve app +
// site. Replaces the old single-product (Messenger) landing page (which
// moved to /messenger/page.tsx).
//
// Visual concept: the giant gold HYVE logo lives at center, slowly
// breathing/pulsing with a hex-grid backdrop matching the logo art. Below
// it, a grid of cards routes the visitor to whichever Hyve product they
// came for. External Hyve sites (hyvealpha.com, hyvecares.org) get cards
// too — visitors don't need to know our internal vs external split, they
// just want to find the right thing.

import Image from 'next/image'
import HyveHubHero from './HyveHubHero'

export const metadata = {
  title: 'HYVE — One ecosystem, every app',
  description:
    'Hyve Spy · Hyve Messenger · Hyve Sleuth · Hyve Residential · Hyve Sentinel — plus Hyvealpha and Hyvecares. The whole Hyve ecosystem in one place.',
}

type App = {
  name: string
  tagline: string
  href: string
  external?: boolean
  logo?: string
  icon?: string
  accent: string
  blurb: string
  badge?: string
}

// Products we run + ship from THIS site (hyveapp.co). Each opens an internal
// route inside the same Next deployment.
const APPS: App[] = [
  {
    name: 'Hyve Spy',
    tagline: 'Live public-safety intelligence',
    href: '/spy',
    logo: '/spy-logo/hyve-spy-logo.png',
    accent: '#E8C456',
    blurb:
      '6,500+ scanner feeds · 73K live cameras · 39K free TV channels · 54K free radio · 164K surveillance markers · 97K offender pins · 57K crime reports across 20 cities. Whisper-STT push alerts, AI summaries, one tap on a map.',
  },
  {
    name: 'Hyve Messenger',
    tagline: 'End-to-end encrypted, location-aware messaging',
    href: '/messenger',
    logo: '/hyve-logo/hyve-messenger.png',
    accent: '#E8C456',
    blurb:
      'A privacy-first messenger with location-aware features, founders pricing, and a no-tracking ethos. iOS + Android beta.',
  },
  {
    name: 'Hyve Sleuth',
    tagline: 'OSINT smart-launcher · 100+ public databases',
    href: '/spy/app/sleuth',
    logo: '/spy-logo/hyve-sleuth-logo.png',
    accent: '#C8A227',
    blurb:
      'Enter a subject → one click opens every relevant resource pre-filled across 100+ databases (CourtListener, PACER, BOP, NSOPW, OpenCorporates, Zillow, voter rolls). PIN-protected profiles, hit/miss tracking. Lives inside Hyve Spy as a Pro tool.',
    badge: 'PRO',
  },
  {
    name: 'Hyve Residential',
    tagline: 'Distressed-property intel for real-estate investors',
    href: '/spy/app/residential',
    logo: '/spy-logo/hyve-residential-logo.png',
    accent: '#F59E0B',
    blurb:
      'Browse every distressed property in your county — foreclosures, tax delinquencies, HOA / mechanic / judgment liens, with distress score and outreach docs. Same data PropStream charges $200/mo for. Lives inside Hyve Spy as a Pro tool.',
    badge: 'PRO',
  },
  {
    name: 'Hyve Sentinel + Scout',
    tagline: 'One-shot security audits — cameras + pen-test',
    href: '/spy/app/sentinel',
    icon: '🔒',
    accent: '#A855F7',
    blurb:
      'Pay once — $9.99–$299.99. List your assets, sign authorization, get a real DNS/TLS/HTTP/port-probed report with severity-color-coded remediation steps. Same legal model as professional pen-testing.',
  },
]

// The wider Hyve ecosystem hosted on Vibe Software Solutions
// (vibesoftwaresolutions.com). Each links out to the VSS product page,
// surfacing the full Hyve catalog without duplicating their pages here.
// Ordered roughly by how flagship each is in VSS's own product navigation.
const VSS_BASE = 'https://www.vibesoftwaresolutions.com'

const ECOSYSTEM: App[] = [
  {
    name: 'Hyve Alpha',
    tagline: "World's first artificial synthetic intelligence",
    href: 'https://www.hyvealpha.com',
    external: true,
    icon: '🧠',
    accent: '#E8C456',
    blurb:
      'Locally-hosted AI workspace with persistent memory, multi-agent chat, art studio, and live agent map. Bring-your-own-key for any LLM provider.',
  },
  {
    name: 'Hyve Cares',
    tagline: 'Free K-12 curriculum + AI tutoring',
    href: 'https://www.hyvecares.org',
    external: true,
    icon: '❤️',
    accent: '#EF4444',
    blurb:
      'Complete K-12 educational curriculum delivered free, with AI tutors, certifications, and community support. The Hyve Foundation.',
  },
  {
    name: 'HYVE Overlord',
    tagline: 'Government-grade unified cybersecurity',
    href: `${VSS_BASE}/hyve-overlord`,
    external: true,
    icon: '🛡',
    accent: '#A855F7',
    blurb:
      '"Government-Grade Unified Cybersecurity Platform with Post-Quantum AI Agent Defense." 59 integrated security modules + AI threat prediction + automated response + compliance automation.',
  },
  {
    name: 'HYVE Raptor',
    tagline: 'Post-quantum AI agent defense',
    href: `${VSS_BASE}/hyve-raptor`,
    external: true,
    icon: '🦅',
    accent: '#FF2D2D',
    blurb:
      'Post-quantum AI agent defense platform with operator desktop, active defense commands, six-framework compliance engine, and embedded offline AI advisor. Monitors AI agents for behavioral anomalies on your own infrastructure.',
  },
  {
    name: 'HYVE OS',
    tagline: 'Quantum · Neural · AI operating system',
    href: `${VSS_BASE}/hyve-os`,
    external: true,
    icon: '⚛️',
    accent: '#22D3EE',
    blurb:
      "World's first hybrid Quantum · Neural · AI operating system. Native Windows desktop integrating quantum circuit simulation, persistent neural memory, and 69 AI providers — locally, encrypted, sovereign.",
  },
  {
    name: 'HYVE Scope',
    tagline: 'Encrypted operational intelligence',
    href: `${VSS_BASE}/hyve-scope`,
    external: true,
    icon: '🎯',
    accent: '#3B82F6',
    blurb:
      'Encrypted operational-intelligence platform for public safety, justice, medical, fire, and military professionals. "Your data is readable only by you — not by servers, not by cloud providers, not by anyone."',
  },
  {
    name: 'HYVE Social',
    tagline: 'AI-powered social media automation',
    href: `${VSS_BASE}/hyve-social`,
    external: true,
    icon: '📣',
    accent: '#EC4899',
    blurb:
      'Free Windows desktop app for social media automation. Schedule posts across 9 platforms, generate branded captions with AI, manage your full content queue from one app — no monthly fees.',
  },
  {
    name: 'HYVE VUE',
    tagline: 'Self-hosted AI operations platform',
    href: `${VSS_BASE}/hyve-vue`,
    external: true,
    icon: '👁',
    accent: '#10B981',
    blurb:
      'Intelligence Infrastructure Platform — visibility, control, and accountability from day one for teams running AI at scale, all self-hosted.',
  },
  {
    name: 'HYVE-CUI',
    tagline: 'DoD contractor compliance automation',
    href: `${VSS_BASE}/hyve-cui`,
    external: true,
    icon: '📋',
    accent: '#8B5CF6',
    blurb:
      '"Encrypted Communications + Compliance Automation for DoD Contractors." Automates CMMC Level 2 and NIST SP 800-171 compliance tracking for orgs handling Controlled Unclassified Information.',
  },
  {
    name: 'HYVE Shield',
    tagline: 'Cybersecurity (revamping)',
    href: `${VSS_BASE}/hyve-shield`,
    external: true,
    icon: '🛡',
    accent: '#64748B',
    blurb:
      'Currently being rebuilt from the ground up. Check the VSS product page for return-to-service updates.',
  },
  {
    name: 'Hyve Tribe',
    tagline: 'Hyve community network',
    href: 'https://www.hyvetribe.com',
    external: true,
    icon: '🤝',
    accent: '#22C55E',
    blurb:
      'The Hyve community hub — connect with other Hyve users, share resources, and stay in the loop on launches across the ecosystem.',
  },
]

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#08070a] font-sans text-[#ede8d8]">
      {/* Honeycomb hex backdrop — extremely subtle, matches logo art */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 100' fill='none' stroke='%23C8A227' stroke-width='1'><polygon points='28,2 54,16 54,46 28,60 2,46 2,16'/><polygon points='28,42 54,56 54,86 28,100 2,86 2,56'/></svg>\")",
          backgroundSize: '56px 100px',
        }}
      />
      {/* Header — minimal, gives the gold logo all the focus */}
      <header className="relative z-30 mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-6">
        <a href="/" className="flex items-center gap-2">
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
            HYVE
          </span>
        </a>
        <nav className="hidden gap-5 text-xs font-bold tracking-[0.2em] text-[#9e8a55] md:flex">
          <a href="#apps" className="transition hover:text-[#E8C456]">APPS</a>
          <a href="/spy" className="transition hover:text-[#E8C456]">SPY</a>
          <a href="/messenger" className="transition hover:text-[#E8C456]">MESSENGER</a>
          <a href="https://www.hyvealpha.com" className="transition hover:text-[#E8C456]" target="_blank" rel="noopener">ALPHA ↗</a>
          <a href="https://www.hyvecares.org" className="transition hover:text-[#E8C456]" target="_blank" rel="noopener">CARES ↗</a>
          <a href="https://www.hyvetribe.com" className="transition hover:text-[#E8C456]" target="_blank" rel="noopener">TRIBE ↗</a>
        </nav>
      </header>

      {/* Hero — animated logo */}
      <HyveHubHero />

      {/* OUR products — apps that live on this site */}
      <section id="apps" className="relative z-10 mx-auto max-w-7xl px-6 pb-16 pt-12">
        <div className="mb-10 text-center">
          <div className="font-mono text-[10px] tracking-[0.4em] text-[#C8A227]">LIVE NOW · HYVEAPP.CO</div>
          <h2 className="mt-2 text-3xl font-black md:text-4xl">Pick an app. They all share one identity.</h2>
          <p className="mt-3 text-sm text-[#9e8a55]">
            Sign in once on any Hyve product — your account works across all of them.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {APPS.map((a) => (
            <AppCard key={a.name} a={a} />
          ))}
        </div>
      </section>

      {/* The wider Hyve ecosystem — products from Vibe Software Solutions */}
      <section id="ecosystem" className="relative z-10 mx-auto max-w-7xl px-6 pb-24 pt-8">
        <div className="mb-10 text-center">
          <div className="font-mono text-[10px] tracking-[0.4em] text-[#C8A227]">FROM THE WIDER HYVE ECOSYSTEM</div>
          <h2 className="mt-2 text-3xl font-black md:text-4xl">More Hyve products from Vibe Software Solutions.</h2>
          <p className="mt-3 text-sm text-[#9e8a55]">
            13 sister products built to the same engineering standard — security, AI, compliance, and operational
            intelligence.{' '}
            <a
              href="https://www.vibesoftwaresolutions.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#E8C456] underline-offset-4 hover:underline"
            >
              Browse the full Vibe Software Solutions catalog ↗
            </a>
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {ECOSYSTEM.map((a) => (
            <AppCard key={a.name} a={a} compact />
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[#2a2135] bg-black/40">
        <div className="mx-auto max-w-7xl px-6 py-10">
          {/* Creator + publisher attribution — required across every page */}
          <div className="mb-8 flex flex-col items-center gap-2 border-b border-[#2a2135] pb-6 text-center">
            <div className="font-mono text-[9px] tracking-[0.4em] text-[#6b5e3a]">CREATED BY</div>
            <p className="text-base font-bold tracking-[0.15em] text-[#ede8d8]">
              ANTHONY S. OWENS
            </p>
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
            <p className="mt-2 max-w-2xl text-[11px] text-[#6b5e3a]">
              Hyve apps are part of a larger product portfolio at vibesoftwaresolutions.com — including
              Overlord, Raptor, Shield, OS, Scope, Social, VUE, and CUI. Plus the community network at{' '}
              <a href="https://www.hyvetribe.com" target="_blank" rel="noopener" className="text-[#E8C456] underline-offset-4 hover:underline">hyvetribe.com</a>.
            </p>
          </div>

          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
            <div className="flex items-center gap-2">
              <Image src="/hyve-logo/hyve-messenger-emblem.png" alt="Hyve" width={32} height={32} className="h-7 w-7" />
              <span className="font-mono text-[10px] tracking-[0.3em] text-[#9e8a55]">© 2026 HYVE</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-mono text-[10px] tracking-[0.2em] text-[#6b5e3a]">
              <a href="/spy" className="hover:text-[#E8C456]">SPY</a>
              <a href="/messenger" className="hover:text-[#E8C456]">MESSENGER</a>
              <a href="/spy/app/sleuth" className="hover:text-[#E8C456]">SLEUTH</a>
              <a href="/spy/app/residential" className="hover:text-[#E8C456]">RESIDENTIAL</a>
              <a href="/spy/app/sentinel" className="hover:text-[#E8C456]">SENTINEL</a>
              <a href="https://www.hyvealpha.com" target="_blank" rel="noopener" className="hover:text-[#E8C456]">ALPHA ↗</a>
              <a href="https://www.hyvecares.org" target="_blank" rel="noopener" className="hover:text-[#E8C456]">CARES ↗</a>
              <a href="https://www.hyvetribe.com" target="_blank" rel="noopener" className="hover:text-[#E8C456]">TRIBE ↗</a>
              <a href="https://www.vibesoftwaresolutions.com" target="_blank" rel="noopener" className="hover:text-[#E8C456]">VSS ↗</a>
              <a href="/privacy" className="hover:text-[#E8C456]">PRIVACY</a>
            </div>
          </div>

          <p className="mx-auto mt-6 max-w-3xl text-center text-[10px] leading-relaxed text-[#475569]">
            © {new Date().getFullYear()} Anthony S. Owens / Vibe Software Solutions. All rights reserved.
            HYVE™, Hyve Spy, Hyve Messenger, Hyve Sleuth, Hyve Residential, Hyve Sentinel, Hyve Alpha,
            Hyve Cares, Hyve Tribe, Hyve Overlord, Hyve Raptor, Hyve Shield, Hyve OS, Hyve Scope,
            Hyve Social, Hyve VUE, and Hyve-CUI are trademarks of Vibe Software Solutions.
          </p>
        </div>
      </footer>
    </main>
  )
}

// Shared card component — used by both the hyveapp.co APPS section and the
// VSS ECOSYSTEM section. The `compact` flag is for the ecosystem grid where
// we render 4 columns instead of 3, so the cards need a tighter footprint.
function AppCard({ a, compact = false }: { a: App; compact?: boolean }) {
  return (
    <a
      href={a.href}
      {...(a.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="group relative flex flex-col rounded-xl border-2 p-5 transition hover:scale-[1.01] active:scale-[0.99] sm:p-6"
      style={{ borderColor: `${a.accent}55`, background: `${a.accent}08` }}
    >
      {a.badge && (
        <span
          className="absolute right-4 top-4 rounded border px-1.5 py-0.5 text-[8px] font-bold tracking-[0.2em]"
          style={{ borderColor: a.accent, color: a.accent, background: 'rgba(0,0,0,0.4)' }}
        >
          {a.badge}
        </span>
      )}
      {a.external && !a.badge && (
        <span className="absolute right-4 top-4 rounded border border-[#2a2135] px-1.5 py-0.5 text-[8px] font-bold tracking-[0.2em] text-[#9e8a55]">
          EXTERNAL ↗
        </span>
      )}
      <div className={`flex items-center ${compact ? 'h-12' : 'h-16'}`}>
        {a.logo ? (
          <Image src={a.logo} alt={a.name} width={1536} height={1024} className="h-full w-auto object-contain" />
        ) : (
          <div className={compact ? 'text-3xl' : 'text-4xl'}>{a.icon}</div>
        )}
      </div>
      <div className="mt-3">
        <h3 className={compact ? 'text-base font-black text-[#ede8d8]' : 'text-lg font-black text-[#ede8d8]'}>{a.name}</h3>
        <div className="font-mono text-[10px] tracking-widest" style={{ color: a.accent }}>
          {a.tagline.toUpperCase()}
        </div>
      </div>
      <p className={`mt-2 flex-1 leading-relaxed text-[#9e8a55] ${compact ? 'text-[12px]' : 'text-sm'}`}>{a.blurb}</p>
      <div className="mt-3 flex items-center justify-between font-mono text-[10px] tracking-widest text-[#6b5e3a]">
        <span>{a.external ? 'OPEN SITE →' : 'LAUNCH APP →'}</span>
        <span style={{ color: a.accent }}>↗</span>
      </div>
    </a>
  )
}
