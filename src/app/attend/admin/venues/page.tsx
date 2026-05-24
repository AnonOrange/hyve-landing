import { listAllVenues } from '@/lib/attend/venues/venue-repository'
import AdminVenuesClient from './admin-venues-client'

export const metadata = { title: 'Venues — Attend admin' }
export const dynamic = 'force-dynamic'

export default async function AdminVenuesPage() {
  const venues = await listAllVenues()
  return (
    <div>
      <h2 className="text-xs font-black tracking-[0.2em] text-[#9e8a55]">
        CONTRACTED VENUE SCANS (TIER 2)
      </h2>
      <p className="mt-1 text-xs text-[#9e8a55]">
        Upload an optimized <span className="font-mono">.glb</span> mesh for a venue (HYVE-scanned).
        Name the stage-screen node and give the spawn point + a scale reference.
      </p>
      <AdminVenuesClient venues={venues.map((v) => ({ id: v.id, slug: v.slug, name: v.name }))} />
    </div>
  )
}
