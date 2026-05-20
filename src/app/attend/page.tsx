// /attend — HYVE Attend product landing. Explains what the platform is, who
// it's for, how it works, and the pricing model. The live events feed lives
// at /attend/events.
import Link from 'next/link'

export const metadata = {
  title: 'HYVE Attend — Live events, browser-first',
  description:
    'A live-events platform with ticketing, browser event rooms, evidence-based ' +
    'refunds, and Stripe Connect payouts. For the artists, organisers, and ' +
    'audiences who would rather watch a show than fight a dashboard.',
}

const primaryCTA =
  'inline-flex items-center justify-center rounded bg-[#E8C456] px-5 py-3 text-sm ' +
  'font-black tracking-wider text-black transition hover:brightness-110'

const ghostCTA =
  'inline-flex items-center justify-center rounded border border-[#2a2135] px-5 py-3 ' +
  'text-sm font-black tracking-wider text-[#9e8a55] transition hover:border-[#E8C456] ' +
  'hover:text-[#E8C456]'

const card = 'rounded border border-[#2a2135] bg-[#111111] p-6'
const eyebrow = 'text-[10px] font-black uppercase tracking-[0.3em] text-[#E8C456]'

export default function AttendLanding() {
  return (
    <div className="py-12">
      <Hero />
      <section className="mt-24 grid gap-6 lg:grid-cols-2">
        <ForCreators />
        <ForAttendees />
      </section>
      <HowItWorks />
      <WhatsDifferent />
      <Pricing />
      <FinalCTA />
    </div>
  )
}

function Hero() {
  return (
    <section className="max-w-4xl">
      <p className={eyebrow}>HYVE ATTEND</p>
      <h1 className="mt-4 text-4xl font-black leading-[1.05] md:text-6xl">
        Live shows, in any browser.
      </h1>
      <p className="mt-5 max-w-2xl text-base text-[#9e8a55] md:text-lg">
        A live-events platform for the artists, organisers, and audiences who would
        rather watch a show than fight a dashboard. Ticketing, a real browser event
        room, refunds that work on evidence, and payouts that land in your account.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/attend/events" className={primaryCTA}>
          Browse events
        </Link>
        <Link href="/attend/signup" className={ghostCTA}>
          Host a show
        </Link>
      </div>
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
      <p className="mt-3 text-sm text-[#9e8a55]">
        Ticketing, payouts, promotion, and a real event room — under one roof.
        Pricing is itemised at checkout, payouts settle through Stripe Connect,
        and your audience watches from any browser.
      </p>
      <ul className="mt-5 flex flex-col gap-2 text-sm">
        <Bullet>Low-fee ticketing, all-in itemised at checkout</Bullet>
        <Bullet>Stripe Connect payouts, released after a short settlement hold</Bullet>
        <Bullet>Real-time browser event room — chat, reactions, attendance log</Bullet>
        <Bullet>$50 promotion campaign that goes live with the show</Bullet>
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
      <p className="mt-3 text-sm text-[#9e8a55]">
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
    <section className="mt-24">
      <p className={eyebrow}>How it works</p>
      <h2 className="mt-3 text-2xl font-black md:text-3xl">
        Two clear paths, same room.
      </h2>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Flow
          title="If you are hosting"
          steps={[
            'Create the show — title, time, ticket types.',
            'Pay the $50 promotion fee — funds your campaign.',
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

function WhatsDifferent() {
  return (
    <section className="mt-24">
      <p className={eyebrow}>Why HYVE Attend</p>
      <h2 className="mt-3 text-2xl font-black md:text-3xl">What makes it different.</h2>
      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Pillar
          title="Browser-first"
          body="No app to install — for hosts or audiences. The event room runs in any modern browser, with chat and reactions baked in."
        />
        <Pillar
          title="Evidence-based refunds"
          body="Every refund decision is backed by an attendance, ticket, and stream-health record — calm, quick, and out of the support queue."
        />
        <Pillar
          title="Transparent fees"
          body="Every charge is itemised at checkout. No hidden fees, no aggressive 'no refunds ever' copy, no surprises."
        />
        <Pillar
          title="Real payouts"
          body="Stripe Connect settles your funds after a short hold — they land in your account, not a platform-locked balance."
        />
      </div>
    </section>
  )
}

function Pillar({ title, body }: { title: string; body: string }) {
  return (
    <article className={card}>
      <h3 className="text-base font-black">{title}</h3>
      <p className="mt-2 text-sm text-[#9e8a55]">{body}</p>
    </article>
  )
}

function Pricing() {
  return (
    <section className="mt-24 rounded border border-[#2a2135] bg-[#111111] p-8">
      <p className={eyebrow}>Pricing</p>
      <h2 className="mt-3 text-2xl font-black md:text-3xl">
        $50 to host. Itemised platform fee on tickets.
      </h2>
      <p className="mt-3 max-w-3xl text-sm text-[#9e8a55]">
        Hosting a show is a one-time $50 promotion registration — that fee funds
        your built-in HYVE promotion campaign for the event. Ticket sales carry a
        platform fee that is shown in the checkout breakdown, every time. Stripe
        processor fees and any tax are itemised the same way. No subscriptions, no
        per-seat charges hiding in fine print.
      </p>
    </section>
  )
}

function FinalCTA() {
  return (
    <section className="mt-24 flex flex-col items-start gap-4 rounded border border-[#E8C456] bg-[#15120c] p-8 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-2xl font-black md:text-3xl">Ready when you are.</h2>
        <p className="mt-2 text-sm text-[#9e8a55]">
          Reserve a ticket or host your first show — both start with the same
          calm, transparent flow.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href="/attend/events" className={primaryCTA}>
          Browse events
        </Link>
        <Link href="/attend/signup" className={ghostCTA}>
          Host a show
        </Link>
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
