import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireAttendUser } from '@/lib/attend/identity/roles'
import { getWallet } from '@/lib/attend/wallet/wallet-service'
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
    <div className="py-10">
      <h1 className="text-2xl font-black">Your tickets</h1>

      {groups.length === 0 ? (
        <p className="mt-4 text-sm text-[#9e8a55]">
          No tickets yet —{' '}
          <Link href="/attend/events" className="font-bold text-[#E8C456] hover:underline">
            browse events
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
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
  )
}
