// /attend/events — buyer discovery: featured row, live now, upcoming.
import { getDiscoveryFeed } from '@/lib/attend/discovery/discovery-service'
import DiscoveryClient from './discovery-client'

export const metadata = { title: 'Events — HYVE Attend' }
export const dynamic = 'force-dynamic'

export default async function AttendEvents() {
  const { featured, live, upcoming } = await getDiscoveryFeed()
  return <DiscoveryClient featured={featured} live={live} upcoming={upcoming} />
}
