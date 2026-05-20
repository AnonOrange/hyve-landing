import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { requireCreator } from '@/lib/attend/identity/roles'
import { getCreatorEvent, ForbiddenError, NotFoundError } from '@/lib/attend/events/service'
import { listEventTicketTypes } from '@/lib/attend/ticketing/ticket-type-service'
import { payoutsEnabled } from '@/lib/attend/payments/connect-service'
import { getEventStream } from '@/lib/attend/streaming/streaming-service'
import { freeRegistrationsRemaining } from '@/lib/attend/payments/registration-service'
import EventDashboardClient from './event-dashboard-client'

export const metadata = { title: 'Event — HYVE Attend' }
export const dynamic = 'force-dynamic'

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
        <div className="flex justify-end pt-6">
          <Link
            href={`/attend/creator/events/${params.id}/promotion`}
            className="text-xs font-bold text-[#9e8a55] transition hover:text-[#E8C456]"
          >
            Promotion →
          </Link>
        </div>
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
