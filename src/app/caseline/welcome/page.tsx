// /caseline/welcome — landed here from Stripe after successful payment.
// Verifies the session is paid, issues a license key (idempotently — stored
// on the Stripe subscription metadata so reloads return the SAME key),
// emails it via Resend, then displays the key with download instructions.

import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import Stripe from 'stripe'
import { Resend } from 'resend'

const ACCENT = '#00B4D8'

// License key format: HYVE-XXXX-XXXX-XXXX
// Alphabet excludes ambiguous chars (0/O/1/I/L) so customers can hand-type
// from emails without confusion.
const KEY_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
function genLicenseKey(): string {
  const block = () =>
    Array.from({ length: 4 }, () => KEY_ALPHABET[Math.floor(Math.random() * KEY_ALPHABET.length)]).join('')
  return `HYVE-${block()}-${block()}-${block()}`
}

function licenseEmailHtml(key: string, tier: '5' | '10', firmName: string, expiresIso: string) {
  const tierLabel = tier === '5' ? 'STARTER (5 seats)' : 'FIRM (10 seats)'
  return `
<!doctype html>
<html><body style="background:#08070a;color:#ede8d8;font-family:Helvetica,Arial,sans-serif;margin:0;padding:32px;">
  <div style="max-width:560px;margin:0 auto;background:rgba(0,0,0,0.7);border:1px solid #00b4d8;border-radius:8px;padding:30px;">
    <div style="font-family:Courier,monospace;color:#00b4d8;letter-spacing:4px;font-size:14px;margin-bottom:8px;">HYVE / CASELINE</div>
    <div style="font-size:22px;color:#fff;margin-bottom:18px;">Your license is ready.</div>
    <p>Thanks, <strong>${firmName}</strong> — your <strong>${tierLabel}</strong> subscription is active.</p>
    <div style="margin:22px 0;padding:18px;background:rgba(0,0,0,0.5);border:1px dashed #00b4d8;border-radius:4px;text-align:center;">
      <div style="font-family:Courier,monospace;color:#00b4d8;letter-spacing:2px;font-size:11px;">LICENSE KEY</div>
      <div style="font-family:Courier,monospace;font-size:22px;color:#fff;margin-top:6px;letter-spacing:3px;">${key}</div>
    </div>
    <p>Active through <strong>${expiresIso}</strong>.</p>
    <h3 style="color:#00b4d8;font-size:14px;margin-top:24px;">Activate</h3>
    <ol>
      <li><a href="https://www.hyveapp.co/caseline/download" style="color:#00b4d8;">Download CaseLine</a> for your operating system.</li>
      <li>Open the app → <strong>WORKSPACE → SETTINGS → LICENSE &amp; SEATS</strong>.</li>
      <li>Paste the key above and click <strong>SAVE KEY</strong>.</li>
    </ol>
    <p style="font-size:13px;color:#9e8a55;margin-top:24px;">
      Need help? Reply to this email or write to
      <a href="mailto:support@hyveapp.co" style="color:#00b4d8;">support@hyveapp.co</a>.
    </p>
    <p style="font-size:10px;color:#6b5e3a;margin-top:30px;text-align:center;letter-spacing:0.15em;">
      ANTHONY S. OWENS · c/o VIBE SOFTWARE SOLUTIONS · © 2026 HYVE CASELINE
    </p>
  </div>
</body></html>`
}

interface PageProps {
  searchParams: Promise<{ session_id?: string }>
}

export default async function WelcomePage({ searchParams }: PageProps) {
  const { session_id } = await searchParams

  // No session id → bounce to pricing.
  if (!session_id) redirect('/caseline#pricing')

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) redirect('/caseline#pricing')

  const stripe = new Stripe(stripeKey)

  // Pull session + the subscription that owns its license metadata.
  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.retrieve(session_id, { expand: ['subscription'] })
  } catch {
    redirect('/caseline#pricing')
  }

  const paid = session.payment_status === 'paid' || session.status === 'complete'
  if (!paid) redirect('/caseline#pricing')

  const sub = session.subscription as Stripe.Subscription | null
  if (!sub) {
    // Shouldn't happen for subscription-mode sessions, but render a safe fallback.
    return <FailedFallback reason="No subscription returned by Stripe. Check your email — sales@hyveapp.co will follow up." />
  }

  const tier = (sub.metadata.tier === '10' ? '10' : '5') as '5' | '10'
  const firmName = sub.metadata.firm_name || session.metadata?.firm_name || 'your firm'
  const buyerEmail = session.customer_email || sub.metadata.email || ''

  // Issue license idempotently — the key lives on subscription metadata so
  // any future reload returns the SAME key.
  let licenseKey = sub.metadata.license_key
  let isFreshIssue = false
  if (!licenseKey) {
    licenseKey = genLicenseKey()
    const issuedAt = Date.now()
    const expiresAt = issuedAt + 365 * 24 * 60 * 60 * 1000
    try {
      await stripe.subscriptions.update(sub.id, {
        metadata: {
          ...sub.metadata,
          license_key: licenseKey,
          issued_at: String(issuedAt),
          expires_at: String(expiresAt),
        },
      })
    } catch (err) {
      console.error('[caseline/welcome] failed to persist license key on Stripe subscription', err)
    }
    isFreshIssue = true

    // Fire-and-forget license email (don't block render if Resend hiccups).
    if (buyerEmail && process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY)
        const expiresIso = new Date(expiresAt).toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric',
        })
        await resend.emails.send({
          from: 'Hyve CaseLine <no-reply@hyveapp.co>',
          to: buyerEmail,
          subject: `Your Hyve CaseLine license — ${tier === '5' ? 'STARTER' : 'FIRM'}`,
          html: licenseEmailHtml(licenseKey, tier, firmName, expiresIso),
        })
      } catch (err) {
        console.error('[caseline/welcome] resend email failed', err)
      }
    }
  }

  const expiresAtMs = Number(sub.metadata.expires_at || Date.now() + 365 * 24 * 60 * 60 * 1000)
  const expiresIso = new Date(expiresAtMs).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
  const tierLabel = tier === '5' ? 'STARTER · 5 seats' : 'FIRM · 10 seats'

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

      <section className="relative z-10 mx-auto max-w-3xl px-6 py-12 text-center md:py-16">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border-2"
             style={{ borderColor: ACCENT, background: `${ACCENT}15` }}>
          <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke={ACCENT} strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="font-mono text-[11px] tracking-[0.4em]" style={{ color: ACCENT }}>PAYMENT CONFIRMED</div>
        <h1 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">You&rsquo;re in, {firmName}.</h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[#9e8a55] md:text-base">
          {tierLabel}. Active through <strong className="text-[#ede8d8]">{expiresIso}</strong>.
          {isFreshIssue && buyerEmail && (
            <> A copy of this license key was just emailed to <strong className="text-[#ede8d8]">{buyerEmail}</strong>.</>
          )}
        </p>

        {/* License key card */}
        <div
          className="mx-auto mt-10 max-w-xl rounded-xl border-2 p-7"
          style={{ borderColor: ACCENT, background: `${ACCENT}10`, boxShadow: `0 0 24px ${ACCENT}33` }}
        >
          <div className="font-mono text-[10px] tracking-[0.3em]" style={{ color: ACCENT }}>YOUR LICENSE KEY</div>
          <div className="mt-3 select-all font-mono text-2xl font-bold tracking-[0.25em] text-[#ede8d8] md:text-3xl">
            {licenseKey}
          </div>
          <p className="mt-4 text-[11px] text-[#9e8a55]">
            Save this somewhere safe. You can also retrieve it any time by re-opening the email we just sent.
          </p>
        </div>

        {/* Activation steps */}
        <div className="mx-auto mt-8 max-w-xl rounded-xl border-2 p-6 text-left"
             style={{ borderColor: '#2a2135', background: 'rgba(0,0,0,0.4)' }}>
          <div className="font-mono text-[10px] tracking-[0.3em] text-[#9e8a55]">NEXT STEPS</div>
          <ol className="mt-4 space-y-3 text-sm text-[#ede8d8]">
            <li>
              <span className="font-mono text-[10px] tracking-[0.2em]" style={{ color: ACCENT }}>1.</span>{' '}
              <Link href="/caseline/download" className="underline-offset-4 hover:underline" style={{ color: ACCENT }}>
                Download the desktop app
              </Link>{' '}
              for your operating system.
            </li>
            <li>
              <span className="font-mono text-[10px] tracking-[0.2em]" style={{ color: ACCENT }}>2.</span>{' '}
              Open the app → <strong>WORKSPACE → SETTINGS → LICENSE &amp; SEATS</strong>.
            </li>
            <li>
              <span className="font-mono text-[10px] tracking-[0.2em]" style={{ color: ACCENT }}>3.</span>{' '}
              Paste your key and click <strong>SAVE KEY</strong>. Done — you&rsquo;ve got {tier === '5' ? '5' : '10'} seats to invite teammates.
            </li>
          </ol>
        </div>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/caseline/download"
            className="rounded px-7 py-3 font-mono text-sm font-bold tracking-[0.3em] text-black transition hover:scale-[1.02]"
            style={{ background: ACCENT, boxShadow: `0 0 22px ${ACCENT}77` }}
          >
            DOWNLOAD →
          </Link>
          <a
            href="mailto:support@hyveapp.co?subject=CaseLine%20activation%20help"
            className="rounded border-2 px-7 py-3 font-mono text-sm font-bold tracking-[0.3em] transition hover:bg-white/5"
            style={{ borderColor: ACCENT, color: ACCENT }}
          >
            NEED HELP?
          </a>
        </div>
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

function FailedFallback({ reason }: { reason: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#08070a] px-6 text-center font-sans text-[#ede8d8]">
      <div className="max-w-md">
        <div className="font-mono text-[10px] tracking-[0.4em]" style={{ color: ACCENT }}>HOLD ON</div>
        <h1 className="mt-2 text-2xl font-black">We couldn&rsquo;t finalize that.</h1>
        <p className="mt-3 text-sm text-[#9e8a55]">{reason}</p>
        <a
          href="mailto:support@hyveapp.co"
          className="mt-6 inline-block rounded border-2 px-6 py-3 font-mono text-xs font-bold tracking-[0.3em]"
          style={{ borderColor: ACCENT, color: ACCENT }}
        >
          CONTACT SUPPORT
        </a>
      </div>
    </main>
  )
}
