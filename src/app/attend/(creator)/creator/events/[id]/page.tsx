import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { requireCreator } from '@/lib/attend/identity/roles'
import { getCreatorEvent, ForbiddenError, NotFoundError } from '@/lib/attend/events/service'
import { listEventTicketTypes } from '@/lib/attend/ticketing/ticket-type-service'
import { payoutsEnabled } from '@/lib/attend/payments/connect-service'
import { getEventStream } from '@/lib/attend/streaming/streaming-service'
import { freeRegistrationsRemaining } from '@/lib/attend/payments/registration-service'
import { PageHero } from '@/app/attend/_components/page-hero'
import EventDashboardClient from './event-dashboard-client'

export const metadata = { title: 'Event — HYVE Attend' }
export const dynamic = 'force-dynamic'

// Deterministically pick a stage bg per event id so each event dashboard
// has a stable visual identity (refreshes show the same image).
const DASHBOARD_BGS = [
  '/attend/backgrounds/bg-4.png',
  '/attend/backgrounds/bg-7.png',
  '/attend/backgrounds/bg-8.png',
  '/attend/backgrounds/bg-9.png',
  '/attend/backgrounds/bg-11.png',
]
function pickDashboardBg(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0
  return DASHBOARD_BGS[Math.abs(hash) % DASHBOARD_BGS.length]
}

export default async function EventDashboardPage({ params }: { params: { id: string } }) {
  const profile = await requireCreator()
  if (!profile) redirect('/attend/login')
  try {
    const [event, ticketTypes, payouts, stream, freeRemaining] = await Promise.all([
      getCreatorEvent(params.id, profile.id),
      listEventTicketTypes(params.id, profile.id),
      payoutsEnabled(profile.id),
      getEventStream(params.id),
      freeRegistrationsRemaining(profile.id),
    ])
    return (
      <>
        <PageHero
          bg={pickDashboardBg(params.id)}
          eyebrow={event.show_type.replace(/_/g, ' ')}
          title={event.title}
          subtitle={`Status: ${event.status.replace(/_/g, ' ').toLowerCase()}`}
          back={{ href: '/attend/creator', label: 'Back to events' }}
          meta={
            <Link
              href={`/attend/creator/events/${params.id}/promotion`}
              className="font-mono text-[10px] font-bold tracking-widest text-[#E8C456] hover:underline"
            >
              Promotion →
            </Link>
          }
        />
        <EventDashboardClient
          event={event}
          ticketTypes={ticketTypes}
          payoutsEnabled={payouts}
          stream={stream}
          freeRegistrationsRemaining={freeRemaining}
        />
      </>
    )
  } catch (err) {
    if (err instanceof NotFoundError || err instanceof ForbiddenError) notFound()
    throw err
  }
}
