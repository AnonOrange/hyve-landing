import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireCreator } from '@/lib/attend/identity/roles'
import { listMyEvents } from '@/lib/attend/events/service'
import { payoutsEnabled } from '@/lib/attend/payments/connect-service'
import { PageHero } from '@/app/attend/_components/page-hero'
import { BrandAd } from '@/app/attend/_components/brand-ad'
import { ATTEND_BETA_MODE } from '@/lib/attend/config'
import CreatorEventsClient from './creator-events-client'

export const metadata = { title: 'Creator — HYVE Attend' }
export const dynamic = 'force-dynamic'

export default async function CreatorPage() {
  const profile = await requireCreator()
  if (!profile) redirect('/attend/login')
  const [events, payouts] = await Promise.all([
    listMyEvents(profile.id),
    payoutsEnabled(profile.id),
  ])
  return (
    <>
      <PageHero
        bg="/attend/backgrounds/bg-4.png"
        eyebrow={ATTEND_BETA_MODE ? 'Creator · Beta' : 'Creator'}
        title="Run a live show like a working business."
        subtitle={
          ATTEND_BETA_MODE
            ? "We're in beta — everything's free right now. No $50 fee, 0% platform fee, you keep 100% of ticket sales (only card processing applies)."
            : 'Ticketing, payouts, promotion, and a real browser event room — under one roof.'
        }
        meta={
          <Link
            href="/attend/creator/payouts"
            className="font-mono text-[10px] font-bold tracking-widest text-[#E8C456] backdrop-blur hover:underline"
          >
            View payouts →
          </Link>
        }
      />
      <CreatorEventsClient events={events} payoutsEnabled={payouts} />
      {events.length === 0 && (
        <section className="mt-10 grid gap-6 md:grid-cols-2">
          <BrandAd
            src="/attend/ads/ad-29.png"
            alt="HYVE Attend — hosting a show, end to end"
            caption="Create a draft, ticketise it, register, connect payouts, go live. The platform tracks every step."
          />
          <BrandAd
            src="/attend/ads/ad-32.png"
            alt="HYVE Attend — promote smarter, track better"
            caption="Every registered show gets a built-in promotion campaign across the platform."
          />
        </section>
      )}
    </>
  )
}
