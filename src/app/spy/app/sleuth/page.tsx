'use client'

// Hyve Sleuth — National OSINT Smart Launcher.
//
// Sleuth is a self-contained static web app that lives in /public/sleuth/
// (index.html + hyve-part2.js + logo + how-to). It's ~120KB of HTML/JS with
// no backend; the entire feature is a curated catalog of 100+ public OSINT
// resources (courts, corrections, sex-offender registries, business
// registries, real estate, social, etc.) that smart-launch external tabs
// based on the subject info you enter.
//
// Why iframe rather than port to React: the Sleuth source is mature and
// self-contained. Re-implementing it in React would take days; iframing
// preserves every feature (PIN-protected profiles, hit/miss tracking,
// per-section launch buttons, notes export) for free.
//
// Pro gate: the Sleuth experience is positioned as a Pro-tier feature.
// We check for `hyve_spy_tier=pro` cookie. If absent, render an upgrade
// prompt that links to /spy#pricing instead of the iframe. The cookie is
// set by /api/spy/checkout success path for the Pro tier (existing
// infrastructure — see src/app/api/spy/checkout/route.ts).

import { useEffect, useState } from 'react'
import Image from 'next/image'

export default function SleuthPage() {
  const [tier, setTier] = useState<'pro' | 'basic' | null>(null)

  // Read the tier cookie client-side. Done in useEffect so we don't render
  // the upgrade prompt during SSR for users who actually have access.
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
    <main className="relative h-screen w-full bg-[#020D14] text-[#E2E8F0]">
      <div className="flex items-center justify-between gap-3 border-b border-[#1c1724] bg-[#08070a] px-4 py-3">
        <div className="flex items-center gap-3">
          <Image
            src="/spy-logo/hyve-sleuth-logo.png"
            alt="Hyve Sleuth"
            width={1536}
            height={1024}
            className="h-10 w-auto"
            priority
          />
          <div className="hidden sm:block">
            <div className="font-mono text-[10px] tracking-[0.3em] text-[#9e8a55]">National OSINT smart launcher · Pro</div>
          </div>
        </div>
        <a
          href="/sleuth/HOW_TO_USE.html"
          target="_blank"
          rel="noopener"
          className="rounded border border-[#2a2135] px-2.5 py-1 text-[10px] font-bold tracking-widest text-[#9e8a55] hover:border-[#C8A227] hover:text-[#C8A227]"
        >
          📖 HOW TO USE
        </a>
      </div>
      <iframe
        // The static app lives at /sleuth/index.html (served from public/).
        // Sandboxed permissions: needs same-origin (so localStorage profiles
        // persist), forms, popups (smart-launch opens N tabs), and modals.
        src="/sleuth/index.html"
        title="Hyve Sleuth"
        className="h-[calc(100vh-44px)] w-full border-0 bg-[#08070a]"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
      />
    </main>
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
          NATIONAL OSINT SMART LAUNCHER · PRO
        </div>
        <p className="mt-5 text-sm leading-relaxed text-[#94A3B8]">
          Sleuth indexes <span className="text-white">100+ public OSINT resources</span> — court
          dockets, federal inmate locators, sex-offender registries, business filings, property
          records, voter rolls, and more. Enter a subject&apos;s name + optional location;
          one click smart-launches every relevant resource for that profile in new tabs.
        </p>

        <ul className="mt-6 grid gap-2 text-left text-xs text-[#94A3B8]">
          <li className="flex gap-2"><span className="text-[#C8A227]">✓</span> CourtListener · PACER · Justia · UniCourt</li>
          <li className="flex gap-2"><span className="text-[#C8A227]">✓</span> NSOPW · Family Watchdog · state offender registries</li>
          <li className="flex gap-2"><span className="text-[#C8A227]">✓</span> BOP federal inmate locator · VINELink · state DOC</li>
          <li className="flex gap-2"><span className="text-[#C8A227]">✓</span> OpenCorporates · BBB · Zillow · Redfin · property tax</li>
          <li className="flex gap-2"><span className="text-[#C8A227]">✓</span> PIN-protected profiles · hit/miss tracking · notes export</li>
        </ul>

        <div className="mt-7 flex flex-col items-center gap-2">
          <a
            href="/spy#pricing"
            className="rounded px-6 py-3 text-sm font-black tracking-widest text-[#020D14]"
            style={{
              background: 'linear-gradient(135deg, #C8A227, #E8C456)',
              boxShadow: '0 0 60px -10px rgba(200,162,39,0.5)',
            }}
          >
            UPGRADE TO PRO →
          </a>
          <a
            href="/sleuth/HOW_TO_USE.html"
            target="_blank"
            rel="noopener"
            className="text-[10px] font-mono text-[#64748B] underline-offset-4 hover:text-[#94A3B8] hover:underline"
          >
            Read the user guide first
          </a>
        </div>
      </div>
    </main>
  )
}
