import { redirect } from 'next/navigation'
import { requireCreator } from '@/lib/attend/identity/roles'
import { listVenuesManagedBy, getVenueActiveScan } from '@/lib/attend/venues/venue-repository'
import { publicVenueUrl } from '@/lib/attend/venues/venue-storage'
import { venueScanFromManifest } from '@/lib/attend/venues/viewer-math'
import { PageHero } from '@/app/attend/_components/page-hero'
import VenuesClient, { type VenueWithScan } from './venues-client'

export const metadata = { title: 'Venues — HYVE Attend' }
export const dynamic = 'force-dynamic'

export default async function CreatorVenuesPage() {
  const profile = await requireCreator()
  if (!profile) redirect('/attend/login')
  const venues = await listVenuesManagedBy(profile.id)

  const withScan: VenueWithScan[] = await Promise.all(
    venues.map(async (v) => {
      const asset = await getVenueActiveScan(v.id)
      const scan = asset
        ? venueScanFromManifest(asset.manifest, publicVenueUrl(asset.storagePath))
        : null
      return { id: v.id, slug: v.slug, name: v.name, scan }
    }),
  )

  return (
    <>
      <PageHero
        bg="/attend/backgrounds/bg-8.png"
        eyebrow="Venues"
        title="Your venues, in 3D."
        subtitle="Upload a 360° scan of your space, mark where the stage screen sits, and it becomes a virtual venue for your shows. Bigger captures (walkable 3D) can be scanned by HYVE."
        back={{ href: '/attend/creator', label: 'Back to events' }}
      />
      <VenuesClient venues={withScan} />
    </>
  )
}
