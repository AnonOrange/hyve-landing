// /attend/claim — the transfer recipient's claim flow. Deliberately outside
// the (attendee) group: an anonymous recipient must reach it; the claim action
// (the POST) is what requires sign-in.
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

  return <ClaimClient token={token} eventTitle={eventTitle} unavailable={unavailable} />
}
