import { getDisputeQueue } from '@/lib/attend/disputes/dispute-service'
import { isDisputeDueSoon } from '@/lib/attend/disputes/dispute-recommendation'
import { BrandAd } from '@/app/attend/_components/brand-ad'
import DisputeActionClient from './dispute-action-client'

export const metadata = { title: 'Disputes — Attend admin' }
export const dynamic = 'force-dynamic'

const OPEN_STATUSES = ['NEEDS_RESPONSE', 'EVIDENCE_BUILDING', 'EVIDENCE_READY', 'ESCALATED']
const usd = (c: number) => `$${(c / 100).toFixed(2)}`
const fmtWhen = (iso: string | null) => (iso ? iso.slice(0, 16).replace('T', ' ') : '—')

export default async function DisputeQueuePage() {
  const disputes = await getDisputeQueue()

  return (
    <div>
      <h2 className="text-xs font-black tracking-[0.2em] text-[#9e8a55]">CARD DISPUTES</h2>
      {disputes.length === 0 ? (
        <div className="mt-3 grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
          <p className="text-sm text-[#9e8a55]">
            No disputes. When Stripe notifies us of one, the evidence packet (attendance
            log, room sessions, refund history, event policy) is assembled automatically
            and queued here for review.
          </p>
          <BrandAd
            src="/attend/ads/ad-28.png"
            alt="HYVE Attend — secure and reliable"
            caption="Card disputes get an auto-built evidence packet. Reviewers accept, contest, or escalate."
          />
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {disputes.map((d) => {
            const open = OPEN_STATUSES.includes(d.status)
            const dueSoon = open && isDisputeDueSoon(d.due_by)
            return (
              <li
                key={d.id}
                className="flex items-start justify-between gap-3 rounded border border-[#2a2135] bg-[#111111] px-4 py-3"
              >
                <div>
                  <span className="text-sm font-bold">
                    {d.attend_events?.title ?? 'Event'}
                  </span>
                  <p className="text-xs text-[#9e8a55]">
                    {usd(d.amount_cents)} · {d.reason ?? 'no reason given'}
                  </p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#9e8a55]">
                    {d.status}
                    {d.due_by && (
                      <span className={dueSoon ? 'text-red-400' : 'text-[#9e8a55]'}>
                        {' '}
                        · responds by {fmtWhen(d.due_by)}
                        {dueSoon ? ' (due soon)' : ''}
                      </span>
                    )}
                  </p>
                </div>
                {open && <DisputeActionClient disputeId={d.id} />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
