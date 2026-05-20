import { notFound, redirect } from 'next/navigation'
import { requireCreator } from '@/lib/attend/identity/roles'
import { ForbiddenError, NotFoundError } from '@/lib/attend/events/service'
import { getPromotionDashboard } from '@/lib/attend/promotion/promotion-service'
import { PageHero } from '@/app/attend/_components/page-hero'
import { BrandAd } from '@/app/attend/_components/brand-ad'
import PromotionClient from './promotion-client'

export const metadata = { title: 'Promotion — HYVE Attend' }
export const dynamic = 'force-dynamic'

export default async function PromotionPage({ params }: { params: { id: string } }) {
  const profile = await requireCreator()
  if (!profile) redirect('/attend/login')
  try {
    const dashboard = await getPromotionDashboard(params.id, profile.id)
    return (
      <>
        <PageHero
          bg="/attend/backgrounds/bg-8.png"
          eyebrow="Promotion"
          title="Promote smarter. Track better."
          subtitle="Your event is featured across HYVE Attend. Tune the ad creative and track how it performs."
          back={{ href: `/attend/creator/events/${params.id}`, label: 'Back to event' }}
        />
        <div className="py-8">
          <PromotionClient eventId={params.id} dashboard={dashboard} />
          <section className="mt-10 grid gap-6 lg:grid-cols-2">
            <BrandAd
              src="/attend/ads/ad-32.png"
              alt="HYVE Attend — promote smarter, track better"
              caption="Impressions, clicks, and click-through rate are tracked per featured campaign."
            />
            <BrandAd
              src="/attend/ads/ad-34.png"
              alt="HYVE Attend — actionable insights"
              caption="Every dollar of your registration fee funds the campaign that surfaces your show across the platform."
            />
          </section>
        </div>
      </>
    )
  } catch (err) {
    if (err instanceof NotFoundError || err instanceof ForbiddenError) notFound()
    throw err
  }
}
