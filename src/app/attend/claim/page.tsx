// /attend/claim — the transfer recipient's claim flow. Deliberately outside
// the (attendee) group: an anonymous recipient must reach it; the claim action
// (the POST) is what requires sign-in.
import Image from 'next/image'
import { getTransferForClaim } from '@/lib/attend/transfers/transfer-repository'
import ClaimClient from './claim-client'

export const metadata = { title: 'Claim a ticket — HYVE Attend' }
export const dynamic = 'force-dynamic'

export default async function ClaimPage({
  searchParams,
}: {
  searchParams: { token?: string | string[] }
}) {
  const token = typeof searchParams.token === 'string' ? searchParams.token : null
  let eventTitle: string | null = null
  let unavailable = false

  if (token) {
    const transfer = await getTransferForClaim({ claimToken: token })
    if (!transfer) {
      unavailable = true
    } else {
      eventTitle = transfer.attend_tickets.attend_events.title
      if (transfer.status !== 'PENDING') unavailable = true
    }
  }

  return (
    <div className="py-8 lg:py-12">
      <section className="relative -mx-6 mb-10 overflow-hidden sm:rounded-2xl sm:mx-0">
        <Image
          src="/attend/backgrounds/bg-6.png"
          alt=""
          width={1920}
          height={600}
          priority
          className="h-[220px] w-full object-cover md:h-[280px]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#08111e] via-[#08111e]/70 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-10">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#E8C456]">
            CLAIM YOUR TICKET
          </p>
          <h1 className="mt-2 text-3xl font-black text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.6)] md:text-5xl">
            Someone sent you a show.
          </h1>
        </div>
      </section>
      <ClaimClient token={token} eventTitle={eventTitle} unavailable={unavailable} />
    </div>
  )
}
