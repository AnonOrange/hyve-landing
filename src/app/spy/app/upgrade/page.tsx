// /spy/app/upgrade — shown to free + basic users who try to reach a
// gated route. Middleware redirects here with ?tier= (the tier they need)
// and ?from= (the path they tried to reach so we can offer to take them
// back after upgrade).
//
// Always reachable (the upgrade screen itself is in FREE_ALLOWED_PREFIXES
// in middleware) so we never trap users in a redirect loop.

import Link from 'next/link'
import Image from 'next/image'

export const dynamic = 'force-dynamic'

const UPGRADE_TIERS = {
  basic: {
    color: '#00D4FF',
    label: 'BASIC',
    headline: 'This feature needs Basic.',
    blurb:
      'TV, Radio, Crime, Pulse, Roulette, Ticker, Panopticon, and Watchlist all require a Basic subscription. The free tier gives you Scanner + Cameras only.',
    pricePrimary: '$5.99/mo',
    priceSecondary: '$59.99/yr (save $11.89)',
    monthHref: '/api/spy/checkout?plan=monthly&tier=basic',
    yearHref: '/api/spy/checkout?plan=annual&tier=basic',
    bullets: [
      'Everything Free has (Scanner + Cameras)',
      '+ TV · Radio · Crime · Pulse · Roulette · Ticker · Panopticon',
      '+ Watchlist + push alerts within radius',
      '+ Zero ads',
    ],
  },
  pro: {
    color: '#F59E0B',
    label: 'PRO',
    headline: 'This feature needs Pro.',
    blurb:
      'Sleuth (OSINT smart-launcher), Residential (distress property intel), Intel hub (surveillance + offenders), and Globe (worldwide map) are Pro-tier features.',
    pricePrimary: '$9.99/mo · $14.99 monthly',
    priceSecondary: '$149.99/yr (save $29.89)',
    monthHref: '/api/spy/checkout?plan=monthly&tier=pro',
    yearHref: '/api/spy/checkout?plan=annual&tier=pro',
    bullets: [
      'Everything Basic has',
      '+ Hyve Sleuth (100+ OSINT databases)',
      '+ Hyve Residential (distress property intel)',
      '+ Intel hub (surveillance markers, offender pins)',
      '+ Globe view (24K+ worldwide cams)',
    ],
  },
} as const

type UpgradeTier = keyof typeof UPGRADE_TIERS

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string; from?: string }>
}) {
  const params = await searchParams
  const tier: UpgradeTier =
    params.tier === 'pro' ? 'pro' : 'basic'
  const fromPath = params.from || '/spy/app'
  const cfg = UPGRADE_TIERS[tier]

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#08070a] px-6 py-16 text-[#ede8d8]">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex justify-center">
          <Image
            src="/spy-logo/hyve-spy-logo.png"
            alt="Hyve Spy"
            width={1536}
            height={1024}
            priority
            className="h-auto w-full max-w-[260px]"
          />
        </div>

        <div
          className="rounded-2xl border-2 p-6"
          style={{ borderColor: `${cfg.color}80`, background: `${cfg.color}08` }}
        >
          <div
            className="mb-2 text-center font-mono text-[11px] tracking-[0.4em]"
            style={{ color: cfg.color }}
          >
            ◆ UPGRADE TO {cfg.label}
          </div>
          <h1 className="text-center text-2xl font-black">{cfg.headline}</h1>
          <p className="mt-3 text-center text-[13px] leading-relaxed text-[#94A3B8]">
            {cfg.blurb}
          </p>

          <ul className="mt-5 space-y-2">
            {cfg.bullets.map((b) => (
              <li key={b} className="flex items-start gap-2 text-[13px] text-[#E2E8F0]">
                <span style={{ color: cfg.color }} className="mt-0.5">
                  ✓
                </span>
                <span>{b}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 grid gap-2">
            <a
              href={cfg.yearHref}
              className="rounded py-3 text-center text-sm font-black tracking-widest text-[#020D14] transition hover:opacity-90"
              style={{ background: cfg.color, boxShadow: `0 0 60px -10px ${cfg.color}80` }}
            >
              {cfg.label} ANNUAL — {cfg.priceSecondary.split(' ')[0]}
            </a>
            <a
              href={cfg.monthHref}
              className="rounded border py-3 text-center text-sm font-black tracking-widest transition hover:opacity-80"
              style={{ borderColor: cfg.color, color: cfg.color }}
            >
              MONTHLY — {cfg.pricePrimary.split(' ')[0]}
            </a>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center gap-3">
          <Link
            href={fromPath.startsWith('/spy/app') ? '/spy/app' : '/spy/app'}
            className="text-[11px] font-mono tracking-widest text-[#9e8a55] hover:text-[#E8C456]"
          >
            ← BACK TO MAP
          </Link>
          <Link
            href="/spy/app/account"
            className="text-[10px] font-mono text-[#475569] hover:text-[#9e8a55]"
          >
            Manage account
          </Link>
        </div>
      </div>
    </main>
  )
}
