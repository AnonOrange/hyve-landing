import { notFound, redirect } from 'next/navigation'
import { requireAttendUser } from '@/lib/attend/identity/roles'
import { getRoomView } from '@/lib/attend/streaming/room-service'
import RoomClient from './room-client'

export const metadata = { title: 'Live room — HYVE Attend' }
export const dynamic = 'force-dynamic'

export default async function RoomPage({ params }: { params: { slug: string } }) {
  const user = await requireAttendUser()
  if (!user) redirect('/attend/login')
  const view = await getRoomView(params.slug, user.id)
  if (!view) notFound()

  return (
    <RoomClient
      slug={params.slug}
      eventId={view.event.id}
      eventTitle={view.event.title}
      eventStatus={view.event.status}
      playbackId={view.playbackId}
      playbackToken={view.playbackToken}
      venueScan={view.venueScan}
    />
  )
}
