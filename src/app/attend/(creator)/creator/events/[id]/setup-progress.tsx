import { draftTargetStatus, type EventStatus } from '@/lib/attend/events/lifecycle'

type Step = { status: EventStatus; label: string }

// A paid show walks the full setup chain; a FREE_EVENT skips the registration
// fee + payout gates (spec §6.9). These are the chains the stepper renders.
const PAID_CHAIN: Step[] = [
  { status: 'DRAFT', label: 'Draft' },
  { status: 'REGISTRATION_PENDING', label: 'Registration' },
  { status: 'PROMOTION_FEE_PAID', label: 'Fee paid' },
  { status: 'PAYOUT_SETUP_REQUIRED', label: 'Payouts' },
  { status: 'STREAM_SETUP_REQUIRED', label: 'Stream' },
  { status: 'SUBMITTED_FOR_REVIEW', label: 'Review' },
  { status: 'PUBLISHED', label: 'Published' },
]

const FREE_CHAIN: Step[] = [
  { status: 'DRAFT', label: 'Draft' },
  { status: 'STREAM_SETUP_REQUIRED', label: 'Stream' },
  { status: 'SUBMITTED_FOR_REVIEW', label: 'Review' },
  { status: 'PUBLISHED', label: 'Published' },
]

// Presentational: shows where an event sits in its setup chain. Plain
// component (no hooks) — renders fine inside the client dashboard.
export default function SetupProgress({
  status,
  showType,
}: {
  status: EventStatus
  showType: string
}) {
  const chain = draftTargetStatus(showType) === 'STREAM_SETUP_REQUIRED' ? FREE_CHAIN : PAID_CHAIN
  const currentIndex = chain.findIndex((s) => s.status === status)
  // Outside the chain (ON_SALE onward, CANCELLED, …): the whole chain is behind us.
  const reached = currentIndex === -1 ? chain.length : currentIndex

  return (
    <section className="rounded border border-[#2a2135] bg-[#111111] px-4 py-4">
      <h2 className="text-xs font-black tracking-[0.2em] text-[#9e8a55]">SETUP PROGRESS</h2>
      <ol className="mt-3 flex items-start gap-1">
        {chain.map((step, i) => {
          const done = i < reached
          const current = i === reached
          return (
            <li
              key={step.status}
              className="flex flex-1 flex-col items-center gap-1.5 text-center"
            >
              <span
                className={
                  'h-2.5 w-2.5 rounded-full ' +
                  (done
                    ? 'bg-[#E8C456]'
                    : current
                      ? 'bg-transparent ring-2 ring-[#E8C456]'
                      : 'bg-[#2a2135]')
                }
              />
              <span
                className={
                  'text-[9px] font-bold uppercase tracking-wider ' +
                  (done ? 'text-[#ede8d8]' : current ? 'text-[#E8C456]' : 'text-[#9e8a55]')
                }
              >
                {step.label}
              </span>
            </li>
          )
        })}
      </ol>
      <p className="mt-3 font-mono text-[10px] tracking-widest text-[#9e8a55]">
        CURRENT STATUS: <span className="text-[#E8C456]">{status}</span>
      </p>
    </section>
  )
}
