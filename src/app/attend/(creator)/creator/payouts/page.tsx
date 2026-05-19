import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireCreator } from '@/lib/attend/identity/roles'
import { listCreatorPayouts } from '@/lib/attend/payouts/settlement-service'

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
    <div className="py-10">
      <Link
        href="/attend/creator"
        className="text-xs font-bold text-[#9e8a55] hover:text-[#E8C456]"
      >
        ← Back to events
      </Link>
      <h1 className="mt-3 text-2xl font-black">Payouts</h1>
      <p className="mt-1 text-sm text-[#9e8a55]">
        Funds are held for a short window after each event, then released to your
        connected payout account.
      </p>

      {payouts.length === 0 ? (
        <p className="mt-6 text-sm text-[#9e8a55]">No payouts yet.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
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
  )
}
