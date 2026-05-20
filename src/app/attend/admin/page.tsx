import { listEventsByStatus } from '@/lib/attend/events/repository'
import { evaluateEventRisk } from '@/lib/attend/risk/risk-service'
import { BrandAd } from '@/app/attend/_components/brand-ad'
import ReviewClient from './review-client'

export const metadata = { title: 'Attend admin' }
export const dynamic = 'force-dynamic'

const fmtWhen = (iso: string | null) => (iso ? iso.slice(0, 16).replace('T', ' ') : 'Date TBA')

const riskColor: Record<string, string> = {
  LOW: 'text-green-400',
  MEDIUM: 'text-[#E8C456]',
  HIGH: 'text-red-400',
}

export default async function AdminPage() {
  const events = await listEventsByStatus('SUBMITTED_FOR_REVIEW')
  const risks = await Promise.all(events.map((ev) => evaluateEventRisk(ev.id)))

  return (
    <div>
      <h2 className="text-xs font-black tracking-[0.2em] text-[#9e8a55]">
        EVENTS AWAITING REVIEW
      </h2>
      {events.length === 0 ? (
        <div className="mt-3 grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
          <p className="text-sm text-[#9e8a55]">
            No events awaiting review. New submissions appear here with an automatic
            risk band (LOW / MEDIUM / HIGH) so the highest-signal submissions get human
            eyes first.
          </p>
          <BrandAd
            src="/attend/ads/ad-30.png"
            alt="HYVE Attend — actionable insights"
            caption="Submissions are auto-scored against event details, creator history, ticket pricing, and timing signals."
          />
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {events.map((ev, i) => (
            <li
              key={ev.id}
              className="flex items-center justify-between gap-3 rounded border border-[#2a2135] bg-[#111111] px-4 py-3"
            >
              <div>
                <span className="text-sm font-bold">{ev.title}</span>
                <p className="text-xs text-[#9e8a55]">
                  {ev.show_type} · starts {fmtWhen(ev.starts_at)}
                </p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#9e8a55]">
                  Risk:{' '}
                  <span className={riskColor[risks[i].band] ?? 'text-[#9e8a55]'}>
                    {risks[i].band} ({risks[i].score})
                  </span>
                </p>
              </div>
              <ReviewClient eventId={ev.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
