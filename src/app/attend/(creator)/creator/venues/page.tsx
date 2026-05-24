import { redirect } from 'next/navigation'
import { requireCreator } from '@/lib/attend/identity/roles'
import { listVenuesManagedBy } from '@/lib/attend/venues/venue-repository'
import { PageHero } from '@/app/attend/_components/page-hero'
import VenuesClient from './venues-client'

export const metadata = { title: 'Venues — HYVE Attend' }
export const dynamic = 'force-dynamic'

export default async function CreatorVenuesPage() {
  const profile = await requireCreator()
  if (!profile) redirect('/attend/login')
  const venues = await listVenuesManagedBy(profile.id)

  return (
    <>
      <PageHero
        bg="/attend/backgrounds/bg-8.png"
        eyebrow="Venues"
        title="Your venues, in 3D."
        subtitle="Upload a 360° scan of your space, mark where the stage screen sits, and it becomes a virtual venue for your shows. Bigger captures (walkable 3D) can be scanned by HYVE."
        back={{ href: '/attend/creator', label: 'Back to events' }}
      />
      <VenuesClient venues={venues.map((v) => ({ id: v.id, slug: v.slug, name: v.name }))} />
    </>
  )
}
