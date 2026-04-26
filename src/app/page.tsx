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
  {
    name: 'Hyve Alpha',
    tagline: 'AI agent platform — chat, memory, art studio, live agents',
    href: 'https://www.hyvealpha.com',
    external: true,
    icon: '🧠',
    accent: '#E8C456',
    blurb:
      'A flexible-themed AI workspace with persistent memory, multi-agent chat, an art studio, and a live-map of agents. Bring-your-own-key for any LLM provider.',
  },
  {
    name: 'Hyve Cares',
    tagline: 'Hyve Foundation — community + support',
    href: 'https://www.hyvecares.org',
    external: true,
    icon: '❤️',
    accent: '#EF4444',
    blurb:
      'The Hyve Foundation. Community programs, support resources, and giving-back initiatives across the Hyve ecosystem.',
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
        <nav className="hidden gap-6 text-xs font-bold tracking-[0.2em] text-[#9e8a55] md:flex">
          <a href="#apps" className="transition hover:text-[#E8C456]">APPS</a>
          <a href="/spy" className="transition hover:text-[#E8C456]">SPY</a>
          <a href="/messenger" className="transition hover:text-[#E8C456]">MESSENGER</a>
          <a href="https://www.hyvealpha.com" className="transition hover:text-[#E8C456]" target="_blank" rel="noopener">ALPHA ↗</a>
          <a href="https://www.hyvecares.org" className="transition hover:text-[#E8C456]" target="_blank" rel="noopener">CARES ↗</a>
        </nav>
      </header>

      {/* Hero — animated logo */}
      <HyveHubHero />

      {/* Apps grid */}
      <section id="apps" className="relative z-10 mx-auto max-w-7xl px-6 pb-24 pt-12">
        <div className="mb-10 text-center">
          <div className="font-mono text-[10px] tracking-[0.4em] text-[#C8A227]">THE HYVE ECOSYSTEM</div>
          <h2 className="mt-2 text-3xl font-black md:text-4xl">Pick an app. They all share one identity.</h2>
          <p className="mt-3 text-sm text-[#9e8a55]">
            Sign in once on any Hyve product — your account works across all of them.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {APPS.map((a) => (
            <a
              key={a.name}
              href={a.href}
              {...(a.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="group relative flex flex-col rounded-xl border-2 p-6 transition hover:scale-[1.01] active:scale-[0.99]"
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
              {a.external && (
                <span
                  className="absolute right-4 top-4 rounded border border-[#2a2135] px-1.5 py-0.5 text-[8px] font-bold tracking-[0.2em] text-[#9e8a55]"
                >
                  EXTERNAL ↗
                </span>
              )}
              <div className="flex h-16 items-center">
                {a.logo ? (
                  <Image
                    src={a.logo}
                    alt={a.name}
                    width={1536}
                    height={1024}
                    className="h-full w-auto object-contain"
                  />
                ) : (
                  <div className="text-4xl">{a.icon}</div>
                )}
              </div>
              <div className="mt-4">
                <h3 className="text-lg font-black text-[#ede8d8]">{a.name}</h3>
                <div className="font-mono text-[10px] tracking-widest" style={{ color: a.accent }}>
                  {a.tagline.toUpperCase()}
                </div>
              </div>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-[#9e8a55]">{a.blurb}</p>
              <div className="mt-4 flex items-center justify-between text-[10px] font-mono tracking-widest text-[#6b5e3a]">
                <span>{a.external ? 'OPEN SITE →' : 'LAUNCH APP →'}</span>
                <span style={{ color: a.accent }}>↗</span>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[#2a2135] bg-black/40">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-6 py-10 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-2">
            <Image src="/hyve-logo/hyve-messenger-emblem.png" alt="Hyve" width={32} height={32} className="h-7 w-7" />
            <span className="font-mono text-[10px] tracking-[0.3em] text-[#9e8a55]">© 2026 HYVE</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-5 font-mono text-[10px] tracking-[0.2em] text-[#6b5e3a]">
            <a href="/spy" className="hover:text-[#E8C456]">SPY</a>
            <a href="/messenger" className="hover:text-[#E8C456]">MESSENGER</a>
            <a href="/spy/app/sleuth" className="hover:text-[#E8C456]">SLEUTH</a>
            <a href="/spy/app/residential" className="hover:text-[#E8C456]">RESIDENTIAL</a>
            <a href="/spy/app/sentinel" className="hover:text-[#E8C456]">SENTINEL</a>
            <a href="https://www.hyvealpha.com" target="_blank" rel="noopener" className="hover:text-[#E8C456]">ALPHA ↗</a>
            <a href="https://www.hyvecares.org" target="_blank" rel="noopener" className="hover:text-[#E8C456]">CARES ↗</a>
            <a href="/privacy" className="hover:text-[#E8C456]">PRIVACY</a>
          </div>
        </div>
      </footer>
    </main>
  )
}
