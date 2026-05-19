// /attend discovery — browse live and upcoming events (spec §7.1).
import { getDiscoveryFeed } from '@/lib/attend/discovery/discovery-service'
import DiscoveryClient from './discovery-client'

export const dynamic = 'force-dynamic'

export default async function AttendHome() {
  const { featured, live, upcoming } = await getDiscoveryFeed()
  return <DiscoveryClient featured={featured} live={live} upcoming={upcoming} />
}
