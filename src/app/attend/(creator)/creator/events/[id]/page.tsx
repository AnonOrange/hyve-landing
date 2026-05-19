import { notFound, redirect } from 'next/navigation'
import { requireCreator } from '@/lib/attend/identity/roles'
import { getCreatorEvent, ForbiddenError, NotFoundError } from '@/lib/attend/events/service'
import { listEventTicketTypes } from '@/lib/attend/ticketing/ticket-type-service'
import { payoutsEnabled } from '@/lib/attend/payments/connect-service'
import EventDashboardClient from './event-dashboard-client'

export const metadata = { title: 'Event — HYVE Attend' }
export const dynamic = 'force-dynamic'

export default async function EventDashboardPage({ params }: { params: { id: string } }) {
  const profile = await requireCreator()
  if (!profile) redirect('/attend/login')
  try {
    const [event, ticketTypes, payouts] = await Promise.all([
      getCreatorEvent(params.id, profile.id),
      listEventTicketTypes(params.id, profile.id),
      payoutsEnabled(profile.id),
    ])
    return (
      <EventDashboardClient event={event} ticketTypes={ticketTypes} payoutsEnabled={payouts} />
    )
  } catch (err) {
    if (err instanceof NotFoundError || err instanceof ForbiddenError) notFound()
    throw err
  }
}
