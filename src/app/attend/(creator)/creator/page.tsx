import { redirect } from 'next/navigation'
import { requireCreator } from '@/lib/attend/identity/roles'
import { listMyEvents } from '@/lib/attend/events/service'
import CreatorEventsClient from './creator-events-client'

export const metadata = { title: 'Creator — HYVE Attend' }
export const dynamic = 'force-dynamic'

export default async function CreatorPage() {
  const profile = await requireCreator()
  if (!profile) redirect('/attend/login')
  const events = await listMyEvents(profile.id)
  return <CreatorEventsClient events={events} />
}
