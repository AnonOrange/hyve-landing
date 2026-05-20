import { redirect } from 'next/navigation'
import { requireCreator } from '@/lib/attend/identity/roles'
import { listCreatorPayouts } from '@/lib/attend/payouts/settlement-service'
import { PageHero } from '@/app/attend/_components/page-hero'
import { BrandAd } from '@/app/attend/_components/brand-ad'

export const metadata = { title: 'Payouts — HYVE Attend' }
export const dynamic = 'force-dynamic'

const usd = (c: number) => `$${(c / 100).toFixed(2)}`
const fmtWhen = (iso: string | null) => (iso ? iso.slice(0, 10) : '—')

const statusColor: Record<string, string> = {
  HELD: 'text-[#E8C456]',
  RELEASED: 'text-green-400',
  FAILED: 'text-red-400',
  PENDING: 'text-[#9e8a55]',
}

export default async function CreatorPayoutsPage() {
  const profile = await requireCreator()
  if (!profile) redirect('/attend/login')
  const payouts = await listCreatorPayouts(profile.id)

  return (
    <>
      <PageHero
        bg="/attend/backgrounds/bg-7.png"
        eyebrow="Stripe Connect · Payouts"
        title="Real payouts for real events."
        subtitle="Funds are held for a short window after each event, then released to your connected Stripe Connect Express account."
        back={{ href: '/attend/creator', label: 'Back to events' }}
      />

      <div className="py-10">
        {payouts.length === 0 ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
            <div className="rounded border border-[#2a2135] bg-[#111111] px-4 py-4 text-sm text-[#9e8a55]">
              No payouts yet. Once your first show sells tickets and settles, payouts will
              show up here with their release schedule.
            </div>
            <BrandAd
              src="/attend/ads/ad-31.png"
              alt="HYVE Attend — real payouts for real events"
              caption="Connected via Stripe Connect Express. Held briefly, released on schedule, fully itemised."
            />
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {payouts.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 rounded border border-[#2a2135] bg-[#111111] px-4 py-3"
              >
                <div>
                  <span className="text-sm font-bold">{p.attend_events?.title ?? 'Event'}</span>
                  <p className="text-xs text-[#9e8a55]">
                    {p.status === 'RELEASED'
                      ? `Released ${fmtWhen(p.released_at)}`
                      : `Scheduled ${fmtWhen(p.scheduled_release_at)}`}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black">{usd(p.amount_cents)}</span>
                  <p
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      statusColor[p.status] ?? 'text-[#9e8a55]'
                    }`}
                  >
                    {p.status}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
