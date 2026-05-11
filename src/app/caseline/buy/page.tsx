// /caseline/buy — pricing + checkout form. Server component renders the
// page chrome; the form itself is a client component so we can manage
// state, POST to /api/caseline/checkout, and redirect to Stripe.

import Image from 'next/image'
import Link from 'next/link'
import BuyForm from './BuyForm'

export const metadata = {
  title: 'Buy Hyve CaseLine — Subscription pricing',
  description:
    'Annual subscription pricing for Hyve CaseLine. $999/year for 5 seats. $1,799/year for 10 seats. Custom enterprise pricing available.',
}

const ACCENT = '#00B4D8'

export default function BuyPage({ searchParams }: { searchParams: { tier?: string } }) {
  const initialTier = searchParams?.tier === '10' ? '10' : '5'

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#08070a] font-sans text-[#ede8d8]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 100' fill='none' stroke='%23C8A227' stroke-width='1'><polygon points='28,2 54,16 54,46 28,60 2,46 2,16'/><polygon points='28,42 54,56 54,86 28,100 2,86 2,56'/></svg>\")",
          backgroundSize: '56px 100px',
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-25"
        style={{ background: 'radial-gradient(ellipse at top, rgba(0,180,216,0.30), transparent 70%)' }}
      />

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
          <Link href="/caseline" className="transition hover:text-[#00B4D8]">← CASELINE</Link>
          <Link href="/caseline#features" className="transition hover:text-[#00B4D8]">FEATURES</Link>
          <Link href="/caseline/download" className="transition hover:text-[#00B4D8]">DOWNLOAD</Link>
        </nav>
      </header>

      <section className="relative z-10 mx-auto max-w-3xl px-6 py-12 text-center md:py-16">
        <Image
          src="/hyve-logo/hyve-caseline-emblem.png"
          alt="Hyve CaseLine"
          width={220}
          height={220}
          className="mx-auto h-24 w-auto md:h-28"
          style={{ filter: `drop-shadow(0 0 20px ${ACCENT}aa)` }}
          priority
        />
        <div className="mt-6 font-mono text-[11px] tracking-[0.4em]" style={{ color: ACCENT }}>
          CASELINE · CHECKOUT
        </div>
        <h1 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">
          Activate your firm.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[#9e8a55] md:text-base">
          Annual subscription. All desktop features included on every tier.
          License key emailed instantly after payment.
        </p>
      </section>

      <section id="pricing" className="relative z-10 mx-auto max-w-3xl px-6 pb-20">
        <BuyForm initialTier={initialTier} />

        <div className="mt-10 rounded-xl border-2 p-6 text-center" style={{ borderColor: '#2a2135', background: 'rgba(0,0,0,0.4)' }}>
          <div className="font-mono text-[10px] tracking-[0.3em] text-[#9e8a55]">NEED MORE THAN 10 SEATS?</div>
          <h3 className="mt-2 text-xl font-black text-[#ede8d8]">Enterprise pricing</h3>
          <p className="mt-2 text-sm text-[#9e8a55]">
            Custom seat counts, on-prem LLM deployment, SSO, dedicated implementation engineer, SLA-backed uptime.
          </p>
          <a
            href="mailto:sales@hyveapp.co?subject=Enterprise%20CaseLine%20quote"
            className="mt-5 inline-block rounded border-2 px-6 py-2 font-mono text-xs font-bold tracking-[0.3em] transition hover:bg-white/5"
            style={{ borderColor: ACCENT, color: ACCENT }}
          >
            REQUEST QUOTE →
          </a>
        </div>

        <p className="mt-8 text-center text-[10px] tracking-wider text-[#6b5e3a]">
          Secured by Stripe · cancel anytime · 30-day refund window
        </p>
      </section>

      <footer className="relative z-10 mt-10 border-t border-[#2a2135] bg-black/40">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6 flex flex-col items-center gap-2 border-b border-[#2a2135] pb-6 text-center">
            <div className="font-mono text-[9px] tracking-[0.4em] text-[#6b5e3a]">CREATED BY</div>
            <p className="text-sm font-bold tracking-[0.15em] text-[#ede8d8]">ANTHONY S. OWENS</p>
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
          <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between">
            <span className="font-mono text-[10px] tracking-[0.3em] text-[#9e8a55]">© 2026 HYVE CASELINE</span>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-mono text-[10px] tracking-[0.2em] text-[#6b5e3a]">
              <Link href="/caseline" className="hover:text-[#00B4D8]">CASELINE</Link>
              <Link href="/caseline/download" className="hover:text-[#00B4D8]">DOWNLOAD</Link>
              <Link href="/privacy" className="hover:text-[#E8C456]">PRIVACY</Link>
              <a href="mailto:support@hyveapp.co" className="hover:text-[#E8C456]">SUPPORT</a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
