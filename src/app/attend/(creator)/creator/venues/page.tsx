import { redirect } from 'next/navigation'
import { requireCreator } from '@/lib/attend/identity/roles'
import { listVenuesManagedBy, getVenueActivePano } from '@/lib/attend/venues/venue-repository'
import { publicVenueUrl } from '@/lib/attend/venues/venue-storage'
import { PageHero } from '@/app/attend/_components/page-hero'
import VenuesClient, { type VenueWithPano } from './venues-client'

export const metadata = { title: 'Venues — HYVE Attend' }
export const dynamic = 'force-dynamic'

// Pull the angular stageScreen out of a stored manifest, if present.
function stageFromManifest(
  manifest: Record<string, unknown>,
): { azimuthDeg: number; elevationDeg: number; hFovDeg: number } | null {
  const anchors = manifest?.anchors as Record<string, unknown> | undefined
  const ss = anchors?.stageScreen as Record<string, unknown> | undefined
  if (!ss || ss.kind !== 'angular') return null
  return {
    azimuthDeg: Number(ss.azimuthDeg) || 0,
    elevationDeg: Number(ss.elevationDeg) || 0,
    hFovDeg: Number(ss.hFovDeg) || 60,
  }
}

export default async function CreatorVenuesPage() {
  const profile = await requireCreator()
  if (!profile) redirect('/attend/login')
  const venues = await listVenuesManagedBy(profile.id)

  const withPano: VenueWithPano[] = await Promise.all(
    venues.map(async (v) => {
      const pano = await getVenueActivePano(v.id)
      const stage = pano ? stageFromManifest(pano.manifest) : null
      return {
        id: v.id,
        slug: v.slug,
        name: v.name,
        pano: pano && stage ? { url: publicVenueUrl(pano.storagePath), stage } : null,
      }
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
      <VenuesClient venues={withPano} />
    </>
  )
}
