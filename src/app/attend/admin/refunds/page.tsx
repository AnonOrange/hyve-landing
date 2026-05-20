import { getRefundQueue } from '@/lib/attend/refunds/refund-service'
import { BrandAd } from '@/app/attend/_components/brand-ad'
import RefundDecisionClient from './refund-decision-client'

export const metadata = { title: 'Refund queue — Attend admin' }
export const dynamic = 'force-dynamic'

const usd = (c: number | null) => (c == null ? '—' : `$${(c / 100).toFixed(2)}`)
const recColor: Record<string, string> = {
  APPROVE: 'text-green-400',
  DENY: 'text-red-400',
  NEEDS_HUMAN: 'text-[#E8C456]',
}

export default async function RefundQueuePage() {
  const queue = await getRefundQueue()

  return (
    <div>
      <h2 className="text-xs font-black tracking-[0.2em] text-[#9e8a55]">
        REFUND REQUESTS AWAITING A DECISION
      </h2>
      {queue.length === 0 ? (
        <div className="mt-3 grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
          <p className="text-sm text-[#9e8a55]">
            No refund requests to review. New requests appear here with an automated
            APPROVE / DENY / NEEDS_HUMAN recommendation based on attendance + event
            records.
          </p>
          <BrandAd
            src="/attend/ads/ad-26.png"
            alt="HYVE Attend — refunds backed by evidence"
            caption="Every request is auto-scored against attendance, room entries, and event lifecycle records."
          />
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {queue.map((r) => (
            <li
              key={r.id}
              className="flex items-start justify-between gap-3 rounded border border-[#2a2135] bg-[#111111] px-4 py-3"
            >
              <div>
                <span className="text-sm font-bold">
                  {r.attend_events?.title ?? 'Event'}
                </span>
                <p className="text-xs text-[#9e8a55]">
                  {r.attend_tickets?.attend_ticket_types?.name ?? 'Ticket'} ·{' '}
                  {usd(r.amount_cents)}
                </p>
                {r.reason && <p className="mt-1 text-xs text-[#ede8d8]">“{r.reason}”</p>}
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#9e8a55]">
                  System recommendation:{' '}
                  <span className={recColor[r.recommendation ?? ''] ?? 'text-[#9e8a55]'}>
                    {r.recommendation ?? 'PENDING'}
                  </span>
                </p>
              </div>
              <RefundDecisionClient refundRequestId={r.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
