import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireAttendUser } from '@/lib/attend/identity/roles'
import { getWallet } from '@/lib/attend/wallet/wallet-service'
import { PageHero } from '@/app/attend/_components/page-hero'
import { BrandAd } from '@/app/attend/_components/brand-ad'
import WalletTicket from './wallet-ticket'

export const metadata = { title: 'Your tickets — HYVE Attend' }
export const dynamic = 'force-dynamic'

const card = 'rounded border border-[#2a2135] bg-[#111111] px-4 py-4'

const fmtWhen = (iso: string | null) => (iso ? iso.slice(0, 16).replace('T', ' ') : 'Date TBA')

export default async function WalletPage() {
  const user = await requireAttendUser()
  if (!user) redirect('/attend/login')
  const groups = await getWallet(user.id)

  return (
    <div>
      <PageHero
        bg="/attend/backgrounds/bg-9.png"
        eyebrow="Your wallet"
        title="Your tickets, all in one place."
        subtitle="Hold your tickets, transfer them by email or friend code, and request refunds straight from the wallet."
      />

      <div className="py-10">
        {groups.length === 0 ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
            <div className={card}>
              <p className="text-sm text-[#9e8a55]">
                No tickets yet —{' '}
                <Link href="/attend/events" className="font-bold text-[#E8C456] hover:underline">
                  browse events
                </Link>
                .
              </p>
              <p className="mt-3 text-xs text-[#9e8a55]">
                Every ticket you buy or accept by transfer lands here. You can claim a friend
                code into your wallet at{' '}
                <Link href="/attend/claim" className="font-bold text-[#E8C456] hover:underline">
                  /attend/claim
                </Link>
                .
              </p>
            </div>
            <BrandAd
              src="/attend/ads/ad-25.png"
              alt="HYVE Attend — ticket transfers built in"
              caption="Transfer a ticket to a friend by email or 8-character code, anytime before the cut-off."
            />
          </div>
        ) : (
          <ul className="mt-2 flex flex-col gap-3">
            {groups.map((g) => (
              <li key={g.event.id} className={card}>
                <div className="flex items-center justify-between gap-3">
                  <Link
                    href={`/attend/events/${g.event.slug}`}
                    className="text-sm font-black hover:text-[#E8C456]"
                  >
                    {g.event.title}
                  </Link>
                  <span className="font-mono text-[10px] tracking-widest text-[#9e8a55]">
                    {fmtWhen(g.event.starts_at)}
                  </span>
                </div>
                <ul className="mt-3 flex flex-col gap-2">
                  {g.tickets.map((t) => (
                    <WalletTicket key={t.id} ticket={t} />
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
