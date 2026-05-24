import { listAllSponsors } from '@/lib/attend/sponsors/sponsor-service'
import SponsorsAdminClient from './sponsors-admin-client'

export const metadata = { title: 'Sponsors — Attend admin' }
export const dynamic = 'force-dynamic'

export default async function AdminSponsorsPage() {
  const sponsors = await listAllSponsors()
  return (
    <div>
      <h2 className="text-xs font-black tracking-[0.2em] text-[#9e8a55]">SPONSORS</h2>
      <p className="mt-1 text-xs text-[#9e8a55]">
        Add a sponsor and it shows in the site footer. Turn one off to hide it everywhere
        without deleting it.
      </p>
      <SponsorsAdminClient
        sponsors={sponsors.map((s) => ({
          id: s.id,
          name: s.name,
          url: s.url,
          tier: s.tier,
          isActive: s.is_active,
        }))}
      />
    </div>
  )
}
