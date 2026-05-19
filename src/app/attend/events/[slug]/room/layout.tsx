import { redirect } from 'next/navigation'
import { requireAttendUser } from '@/lib/attend/identity/roles'
import { getRoomAccess } from '@/lib/attend/streaming/room-service'

export const dynamic = 'force-dynamic'

// Server-side entry gate for the event room (spec §8.1 — a server component,
// not the shared middleware). Requires a signed-in user holding a room-
// eligible ticket for a live-ish event; otherwise redirects away.
export default async function RoomLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { slug: string }
}) {
  const user = await requireAttendUser()
  if (!user) redirect('/attend/login')
  const access = await getRoomAccess(params.slug, user.id)
  if (!access) redirect(`/attend/events/${params.slug}`)
  return <>{children}</>
}
