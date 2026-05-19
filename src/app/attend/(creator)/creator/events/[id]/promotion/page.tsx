import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { requireCreator } from '@/lib/attend/identity/roles'
import { ForbiddenError, NotFoundError } from '@/lib/attend/events/service'
import { getPromotionDashboard } from '@/lib/attend/promotion/promotion-service'
import PromotionClient from './promotion-client'

export const metadata = { title: 'Promotion — HYVE Attend' }
export const dynamic = 'force-dynamic'

export default async function PromotionPage({ params }: { params: { id: string } }) {
  const profile = await requireCreator()
  if (!profile) redirect('/attend/login')
  try {
    const dashboard = await getPromotionDashboard(params.id, profile.id)
    return (
      <div className="py-10">
        <Link
          href={`/attend/creator/events/${params.id}`}
          className="text-xs font-bold text-[#9e8a55] hover:text-[#E8C456]"
        >
          ← Back to event
        </Link>
        <h1 className="mt-3 text-2xl font-black">Promotion</h1>
        <p className="mt-1 text-sm text-[#9e8a55]">
          Your event is featured across HYVE Attend. Tune the ad creative and
          track how it performs.
        </p>
        <PromotionClient eventId={params.id} dashboard={dashboard} />
      </div>
    )
  } catch (err) {
    if (err instanceof NotFoundError || err instanceof ForbiddenError) notFound()
    throw err
  }
}
