// /caseline/activate?key=HYVE-XXXX-XXXX-XXXX
//
// Landing page for shareable license-invite links — the firm admin sends
// this URL to a teammate, who lands here and gets:
//   1. The license key clearly displayed (so they can paste it manually
//      after install if the deep link doesn't work).
//   2. A "Download CaseLine" CTA if they don't have the desktop app yet.
//   3. A "caseline://" deep-link button that opens the desktop app with
//      the key pre-filled (gracefully degrades if the protocol isn't
//      registered).
//
// We don't validate the key server-side here — that happens on the
// desktop after install, when the app calls /api/caseline/validate.
// Showing the key publicly is fine because it's gated behind seat
// availability (the app refuses to claim a seat if max is reached).

import Image from 'next/image'
import Link from 'next/link'
import ActivateActions from './ActivateActions'

export const metadata = {
  title: 'Activate Hyve CaseLine',
  description: 'Open this link on the computer where you want CaseLine installed. Includes the license key and a one-tap activation flow.',
  robots: { index: false, follow: false },
}

const ACCENT = '#00B4D8'

const KEY_PATTERN = /^HYVE-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/

export default function ActivatePage({ searchParams }: { searchParams: { key?: string } }) {
  const rawKey = (searchParams?.key ?? '').trim().toUpperCase()
  const validShape = KEY_PATTERN.test(rawKey)

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
          <Image src="/hyve-logo/hyve-messenger-emblem.png" alt="Hyve" width={64} height={64} className="h-9 w-9" priority />
          <span
            className="text-sm font-black tracking-[0.3em]"
            style={{
              background: 'linear-gradient(135deg, #C8A227 0%, #E8C456 50%, #C8A227 100%)',
              WebkitBackgroundClip: 'text', backgroundClip: 'text',
              WebkitTextFillColor: 'transparent', color: 'transparent',
            }}
          >
            HYVE / CASELINE
          </span>
        </Link>
      </header>

      <section className="relative z-10 mx-auto max-w-2xl px-6 py-12 text-center md:py-16">
        <Image
          src="/hyve-logo/hyve-caseline-emblem.png"
          alt="Hyve CaseLine"
          width={220} height={220}
          className="mx-auto h-24 w-auto md:h-28"
          style={{ filter: `drop-shadow(0 0 20px ${ACCENT}aa)` }}
          priority
        />
        <div className="mt-6 font-mono text-[11px] tracking-[0.4em]" style={{ color: ACCENT }}>
          ACTIVATE · TEAMMATE INVITE
        </div>
        <h1 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">
          You&rsquo;re invited.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[#9e8a55] md:text-base">
          A teammate at your firm bought a CaseLine subscription and shared a seat with you.
          Install the desktop app and paste the license key below to claim it.
        </p>

        {!validShape ? (
          <div className="mx-auto mt-10 max-w-xl rounded-xl border-2 p-7"
               style={{ borderColor: '#ef4444', background: 'rgba(239,68,68,0.08)' }}>
            <div className="font-mono text-[10px] tracking-[0.3em] text-red-300">INVALID INVITE LINK</div>
            <p className="mt-3 text-sm text-[#ede8d8]">
              The license key in this URL doesn&rsquo;t look right. Ask the person who sent you the link to copy it again,
              or go straight to{' '}
              <Link href="/caseline/buy" className="font-bold underline-offset-4 hover:underline" style={{ color: ACCENT }}>
                /caseline/buy
              </Link>{' '}
              to purchase your own license.
            </p>
          </div>
        ) : (
          <>
            <div
              className="mx-auto mt-10 max-w-xl rounded-xl border-2 p-7"
              style={{ borderColor: ACCENT, background: `${ACCENT}10`, boxShadow: `0 0 24px ${ACCENT}33` }}
            >
              <div className="font-mono text-[10px] tracking-[0.3em]" style={{ color: ACCENT }}>FIRM LICENSE KEY</div>
              <div className="mt-3 select-all font-mono text-2xl font-bold tracking-[0.25em] text-[#ede8d8] md:text-3xl">
                {rawKey}
              </div>
              <p className="mt-4 text-[11px] text-[#9e8a55]">
                Save or copy this somewhere safe. You&rsquo;ll paste it into the desktop app after install.
              </p>
            </div>

            <ActivateActions licenseKey={rawKey} />

            <div className="mx-auto mt-8 max-w-xl rounded-xl border-2 p-6 text-left"
                 style={{ borderColor: '#2a2135', background: 'rgba(0,0,0,0.4)' }}>
              <div className="font-mono text-[10px] tracking-[0.3em] text-[#9e8a55]">3 STEPS</div>
              <ol className="mt-4 space-y-3 text-sm text-[#ede8d8]">
                <li>
                  <span className="font-mono text-[10px] tracking-[0.2em]" style={{ color: ACCENT }}>1.</span>{' '}
                  <Link href="/caseline/download" className="underline-offset-4 hover:underline" style={{ color: ACCENT }}>
                    Download CaseLine for your operating system.
                  </Link>
                </li>
                <li>
                  <span className="font-mono text-[10px] tracking-[0.2em]" style={{ color: ACCENT }}>2.</span>{' '}
                  Install &amp; launch the app, then open <strong>WORKSPACE → SETTINGS → LICENSE &amp; SEATS</strong>.
                </li>
                <li>
                  <span className="font-mono text-[10px] tracking-[0.2em]" style={{ color: ACCENT }}>3.</span>{' '}
                  Paste the key above and click <strong>SAVE KEY</strong>. You&rsquo;ll be claimed as one of the firm&rsquo;s seats.
                </li>
              </ol>
            </div>
          </>
        )}
      </section>

      <footer className="relative z-10 mt-10 border-t border-[#2a2135] bg-black/40">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6 flex flex-col items-center gap-2 border-b border-[#2a2135] pb-6 text-center">
            <div className="font-mono text-[9px] tracking-[0.4em] text-[#6b5e3a]">CREATED BY</div>
            <p className="text-sm font-bold tracking-[0.15em] text-[#ede8d8]">ANTHONY S. OWENS</p>
            <p className="text-[11px] text-[#9e8a55]">
              c/o{' '}
              <a href="https://www.vibesoftwaresolutions.com" target="_blank" rel="noopener noreferrer"
                 className="text-[#E8C456] underline-offset-4 hover:underline">
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
