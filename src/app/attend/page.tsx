// /attend — HYVE Attend product landing. Explains what the platform is, who
// it's for, how it works, and the pricing model. The live events feed lives
// at /attend/events.
import Image from 'next/image'
import Link from 'next/link'
import { ATTEND_BETA_MODE } from '@/lib/attend/config'

export const metadata = {
  title: 'HYVE Attend — Bringing events to life',
  description:
    'A live-events platform with ticketing, browser event rooms, virtual venues, ' +
    'engagement tools, and Stripe Connect payouts. For the artists, organisers, ' +
    'and audiences who would rather watch a show than fight a dashboard.',
  openGraph: {
    title: 'HYVE Attend — Bringing events to life',
    description:
      'A live-events platform with ticketing, browser event rooms, virtual venues, ' +
      'engagement tools, and Stripe Connect payouts.',
    images: ['/attend/logo.png'],
  },
}

// Background gallery — every stage image in the brand library, shown on the
// landing so the visual identity has a clear gallery moment.
const VENUE_BGS = [
  '/attend/backgrounds/bg-4.png',
  '/attend/backgrounds/bg-7.png',
  '/attend/backgrounds/bg-8.png',
  '/attend/backgrounds/bg-9.png',
  '/attend/backgrounds/bg-11.png',
]

const primaryCTA =
  'inline-flex items-center justify-center rounded bg-[#E8C456] px-5 py-3 text-sm ' +
  'font-black tracking-wider text-black transition hover:brightness-110'

const ghostCTA =
  'inline-flex items-center justify-center rounded border border-[#2a2135] px-5 py-3 ' +
  'text-sm font-black tracking-wider text-[#9e8a55] transition hover:border-[#E8C456] ' +
  'hover:text-[#E8C456]'

const ghostCTAOnImage =
  'inline-flex items-center justify-center rounded border border-white/40 ' +
  'bg-black/30 px-5 py-3 text-sm font-black tracking-wider text-white backdrop-blur ' +
  'transition hover:border-[#E8C456] hover:text-[#E8C456]'

const card = 'rounded border border-[#2a2135] bg-[#0E1E3A] p-6'
const eyebrow = 'text-[10px] font-black uppercase tracking-[0.3em] text-[#E8C456]'

// Showcase grid — every ad image the brand has, in numeric order.
const SHOWCASE_ADS = Array.from({ length: 20 }, (_, i) => `/attend/ads/ad-${21 + i}.png`)

export default function AttendLanding() {
  return (
    <div className="pb-12">
      <Hero />
      {ATTEND_BETA_MODE && <BetaDisclaimer />}
      <Intro />
      <section className="mt-20 grid gap-6 lg:grid-cols-2">
        <ForCreators />
        <ForAttendees />
      </section>
      <HowItWorks />
      <FeaturesShowcase />
      <VenuesGallery />
      <Pricing />
      <FinalCTA />
    </div>
  )
}

function BetaDisclaimer() {
  return (
    <section
      className="mt-8 flex flex-col gap-3 rounded-2xl border border-[#E8C456]/60 bg-[#E8C456]/[0.06] p-6 sm:flex-row sm:items-center sm:gap-5 sm:p-7"
      role="note"
      aria-label="HYVE Attend beta disclaimer"
    >
      <span className="self-start rounded-full border border-[#E8C456] bg-[#E8C456]/15 px-2.5 py-1 font-mono text-[10px] font-black uppercase tracking-[0.25em] text-[#E8C456]">
        Beta
      </span>
      <div className="flex-1">
        <h2 className="text-base font-black text-white sm:text-lg">
          We&rsquo;re live in beta — everything&rsquo;s free right now.
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-[#ede8d8]/85">
          HYVE Attend is in public beta while we work the bugs out, so{' '}
          <span className="font-bold text-[#E8C456]">HYVE charges you nothing</span> during
          this window: no $50 registration fee, and 0% platform fee on ticket sales. You
          keep 100% of every ticket — the only deduction is the card processor&rsquo;s own
          fee (Stripe&rsquo;s ~2.9% + 30¢), which isn&rsquo;t ours to waive. Payouts still
          run through Stripe Connect exactly as they will at launch. When beta ends the
          $50 fee and platform percentage turn on — and your first 2 shows stay free.
          If something breaks, please tell us.
        </p>
      </div>
    </section>
  )
}

function Hero() {
  return (
    <section className="relative -mx-6 mt-2 overflow-hidden sm:rounded-2xl sm:mx-0">
      <Image
        src="/attend/backgrounds/bg-1.png"
        alt="A live HYVE Attend show with an audience and stage lighting"
        width={1920}
        height={1080}
        priority
        className="h-[68vh] min-h-[460px] w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#08111e] via-[#08111e]/70 to-transparent" />
      <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-12">
        <p className={eyebrow}>HYVE ATTEND</p>
        <h1 className="mt-4 max-w-4xl text-4xl font-black leading-[1.05] text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.6)] md:text-6xl lg:text-7xl">
          Bringing events to life.
        </h1>
        <p className="mt-5 max-w-2xl text-base text-white/85 md:text-lg">
          A live-events platform with ticketing, browser event rooms, virtual venues,
          and Stripe Connect payouts. Built for the artists, organisers, and audiences
          who would rather watch a show than fight a dashboard.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/attend/events" className={primaryCTA}>
            Browse events
          </Link>
          <Link href="/attend/signup" className={ghostCTAOnImage}>
            Host a show
          </Link>
        </div>
      </div>
    </section>
  )
}

function Intro() {
  return (
    <section className="mt-20 max-w-4xl">
      <p className={eyebrow}>What it is</p>
      <h2 className="mt-3 text-3xl font-black md:text-4xl">
        A working live-events business in your browser.
      </h2>
      <p className="mt-5 text-base text-[#9e8a55] md:text-lg">
        HYVE Attend is a complete platform for putting on live shows —{' '}
        {ATTEND_BETA_MODE ? 'free-to-host-in-beta' : 'low-fee'} ticketing, a real
        browser event room with chat and reactions, automated refund evidence,
        Stripe Connect payouts, and a built-in promotion campaign that goes live
        with every show. Powered by virtual venues, immersive experiences, and
        real-time engagement that connects performers and audiences anywhere in
        the world.
      </p>
    </section>
  )
}

function ForCreators() {
  return (
    <article className={card}>
      <p className={eyebrow}>For artists &amp; organisers</p>
      <h2 className="mt-3 text-2xl font-black md:text-3xl">
        Run a live show like a working business.
      </h2>
      <p className="mt-3 text-sm text-[#94A3B8]">
        Ticketing, payouts, promotion, and a real event room — under one roof.
        Pricing is itemised at checkout, payouts settle through Stripe Connect,
        and your audience watches from any browser.
      </p>
      <ul className="mt-5 flex flex-col gap-2 text-sm">
        <Bullet>
          {ATTEND_BETA_MODE ? (
            <>
              <span className="font-bold text-[#E8C456]">Free during beta</span> — no $50 fee, 0% platform fee; you keep 100% of ticket sales
            </>
          ) : (
            <>
              <span className="font-bold text-[#E8C456]">First 2 shows free</span> — no $50 registration fee, the promotion campaign still runs
            </>
          )}
        </Bullet>
        <Bullet>
          {ATTEND_BETA_MODE
            ? 'Only card processing applies in beta — itemised all-in at checkout'
            : 'Low-fee ticketing, all-in itemised at checkout'}
        </Bullet>
        <Bullet>Stripe Connect payouts, released after a short settlement hold</Bullet>
        <Bullet>Real-time browser event room — chat, reactions, attendance log</Bullet>
        <Bullet>Automated refund + dispute evidence packets</Bullet>
        <Bullet>Ticket transfers by email or friend code, built in</Bullet>
      </ul>
      <Link href="/attend/signup" className={`${primaryCTA} mt-6`}>
        Host a show →
      </Link>
    </article>
  )
}

function ForAttendees() {
  return (
    <article className={card}>
      <p className={eyebrow}>For audiences</p>
      <h2 className="mt-3 text-2xl font-black md:text-3xl">
        Watch from any browser. Calm checkout, no surprises.
      </h2>
      <p className="mt-3 text-sm text-[#94A3B8]">
        Buy a ticket in seconds, see the full breakdown, and join the show with one
        click. Transfer a ticket if your plans change. If something goes wrong,
        request a refund right from your wallet — no support ticket needed.
      </p>
      <ul className="mt-5 flex flex-col gap-2 text-sm">
        <Bullet>All-in pricing shown at checkout — no fine print</Bullet>
        <Bullet>Watch live in any browser — no app to install</Bullet>
        <Bullet>Transfer a ticket by email or friend code</Bullet>
        <Bullet>Chat and react in-room while the show is on</Bullet>
        <Bullet>Refund requests reviewed against attendance + event records</Bullet>
        <Bullet>Every ticket lives in one wallet</Bullet>
      </ul>
      <Link href="/attend/events" className={`${primaryCTA} mt-6`}>
        Browse events →
      </Link>
    </article>
  )
}

function HowItWorks() {
  return (
    <section className="mt-20">
      <p className={eyebrow}>How it works</p>
      <h2 className="mt-3 text-3xl font-black md:text-4xl">Two clear paths, same room.</h2>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Flow
          title="If you are hosting"
          steps={[
            'Create the show — title, time, ticket types.',
            ATTEND_BETA_MODE
              ? 'Register the show — free in beta (no $50 fee, 0% platform fee). Opens the promotion campaign.'
              : 'Register the show — first 2 are free, $50 after that. Funds the promotion campaign.',
            'Connect your payout account (Stripe Connect Express).',
            'Run a stream test, submit for review, publish.',
            'Go live from your RTMP source — your audience joins in their browser.',
            'After the show, your payout releases on its schedule.',
          ]}
        />
        <Flow
          title="If you are watching"
          steps={[
            'Browse events, pick a show, check out.',
            'Find your ticket in your wallet.',
            'Enter the room when doors open.',
            'Watch. Chat. React.',
            'If something goes wrong, request a refund from your wallet.',
          ]}
        />
      </div>
    </section>
  )
}

function Flow({ title, steps }: { title: string; steps: string[] }) {
  return (
    <article className={card}>
      <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[#E8C456]">
        {title}
      </h3>
      <ol className="mt-5 flex flex-col gap-3 text-sm text-[#ede8d8]">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#2a2135] font-mono text-[10px] font-bold text-[#9e8a55]">
              {i + 1}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
    </article>
  )
}

function FeaturesShowcase() {
  return (
    <section className="mt-20">
      <p className={eyebrow}>One platform · endless possibilities</p>
      <h2 className="mt-3 text-3xl font-black md:text-4xl">The full picture.</h2>
      <p className="mt-3 max-w-2xl text-base text-[#9e8a55]">
        Live broadcasts, virtual venues, ticketing, payouts, engagement tools, and
        analytics. One platform connecting artists, venues, and audiences.
      </p>

      <div className="mt-8 overflow-hidden rounded-xl border border-[#2a2135] bg-[#0E1E3A]">
        <Image
          src="/attend/ads/ad-composite.png"
          alt="HYVE Attend — bringing events to life, virtual venues, real possibilities, scan-build-rent, monetise your venue 24/7, more engagement, actionable insights, secure and reliable"
          width={2000}
          height={1125}
          className="w-full"
        />
      </div>

      {/* 2-col grid at large viewports so each marketing poster renders ~700px
          wide and the headline + body copy embedded in the artwork is actually
          readable. Width/height match the source 16:9 aspect (828×466) so
          Next.js reserves a correctly-shaped slot. */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        {SHOWCASE_ADS.map((src, i) => (
          <div
            key={src}
            className="overflow-hidden rounded-lg border border-[#2a2135] bg-[#0E1E3A] transition hover:border-[#E8C456]"
          >
            <Image
              src={src}
              alt={`HYVE Attend feature ${i + 1}`}
              width={1280}
              height={720}
              className="h-auto w-full"
              sizes="(min-width: 1024px) 50vw, 100vw"
            />
          </div>
        ))}
      </div>
    </section>
  )
}

function VenuesGallery() {
  return (
    <section className="mt-20">
      <p className={eyebrow}>Built for every stage</p>
      <h2 className="mt-3 text-3xl font-black md:text-4xl">Venues at every scale.</h2>
      <p className="mt-3 max-w-2xl text-base text-[#9e8a55]">
        From intimate club sets to amphitheatre broadcasts and fully virtual venues —
        HYVE Attend renders for every kind of stage your audience can join from
        their browser.
      </p>
      {/* Stage backgrounds are landscape 16:9, so the tile uses aspect-video.
          The portrait aspect-[4/5] + object-cover combination we had before
          was throwing away the sides of every room. */}
      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {VENUE_BGS.map((src, i) => (
          <div
            key={src}
            className="relative aspect-video overflow-hidden rounded-lg border border-[#2a2135] transition hover:border-[#E8C456]"
          >
            <Image
              src={src}
              alt={`HYVE Attend venue ${i + 1}`}
              width={1280}
              height={720}
              className="h-full w-full object-cover"
              sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#08111e]/70 via-transparent to-transparent" />
          </div>
        ))}
      </div>
    </section>
  )
}

function Pricing() {
  return (
    <section className="mt-20 rounded-2xl border border-[#2a2135] bg-[#0E1E3A] p-8">
      <p className={eyebrow}>Pricing</p>
      {ATTEND_BETA_MODE ? (
        <>
          <h2 className="mt-3 text-3xl font-black md:text-4xl">
            <span className="text-[#E8C456]">Everything&rsquo;s free during beta.</span> Keep 100% of your ticket sales.
          </h2>
          <p className="mt-4 max-w-3xl text-base text-[#94A3B8]">
            While HYVE Attend is in beta, HYVE charges you nothing — no $50 registration
            fee and a 0% platform fee on ticket sales, with the full HYVE promotion
            campaign included on every show. You keep 100% of every ticket; the only
            deduction is the card processor&rsquo;s own fee (Stripe&rsquo;s ~2.9% + 30¢),
            which isn&rsquo;t ours to waive. Payouts settle through Stripe Connect just
            like they will at launch. When beta ends, hosting becomes a one-time $50
            registration per show (your first 2 free) and a small platform percentage on
            tickets — both shown in the checkout breakdown. No subscriptions, no per-seat
            charges hiding in fine print.
          </p>
        </>
      ) : (
        <>
          <h2 className="mt-3 text-3xl font-black md:text-4xl">
            <span className="text-[#E8C456]">First 2 shows free.</span> $50 to host after that. Itemised platform fee on tickets.
          </h2>
          <p className="mt-4 max-w-3xl text-base text-[#94A3B8]">
            Your first two shows register for free — the same built-in HYVE promotion
            campaign goes live with them, on the house. From show three onward, hosting
            is a one-time $50 promotion registration per event, which funds that show's
            campaign. Ticket sales carry a platform fee that's shown in the checkout
            breakdown, every time. Stripe processor fees and any tax are itemised the
            same way. No subscriptions, no per-seat charges hiding in fine print.
          </p>
        </>
      )}
    </section>
  )
}

function FinalCTA() {
  return (
    <section className="relative mt-20 -mx-6 overflow-hidden sm:rounded-2xl sm:mx-0">
      <Image
        src="/attend/backgrounds/bg-10.png"
        alt=""
        width={1920}
        height={1080}
        className="h-[420px] w-full object-cover md:h-[480px]"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#08111e] via-[#08111e]/60 to-transparent" />
      <div className="absolute inset-0 flex flex-col items-start justify-center p-6 sm:p-12">
        <p className={eyebrow}>Get started</p>
        <h2 className="mt-4 max-w-2xl text-3xl font-black leading-[1.1] text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.6)] md:text-5xl">
          Ready when you are.
        </h2>
        <p className="mt-4 max-w-xl text-base text-white/85 md:text-lg">
          Reserve a ticket or host your first show — both start with the same calm,
          transparent flow.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/attend/events" className={primaryCTA}>
            Browse events
          </Link>
          <Link href="/attend/signup" className={ghostCTAOnImage}>
            Host a show
          </Link>
        </div>
      </div>
    </section>
  )
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-[#ede8d8]">
      <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#E8C456]" />
      <span>{children}</span>
    </li>
  )
}
