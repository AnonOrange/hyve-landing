// HYVE Attend settlement — moves finished events through settlement and
// releases matured payouts (spec §16). Two passes, both idempotent and
// retry-safe; a payout that cannot be released yet (open dispute, Connect
// account not ready) is simply left HELD for the next run.
import { attendStripe } from '@/lib/attend/payments/stripe'
import { computeArtistNet } from '@/lib/attend/payouts/settlement-math'
import {
  getEventLedgerEntries,
  listDuePayouts,
  hasOpenDispute,
  getCreatorPayouts,
  type CreatorPayoutRow,
} from '@/lib/attend/payouts/payouts-repository'
import { listEventsByStatus } from '@/lib/attend/events/repository'
import { supaPost } from '@/lib/supabase'

export type { CreatorPayoutRow }

/** Settle pass — every ENDED event gets a HELD payout (or settles directly). */
export async function settleEndedEvents(): Promise<{ scanned: number; settled: number }> {
  const events = await listEventsByStatus('ENDED')
  let settled = 0
  for (const event of events) {
    try {
      const net = computeArtistNet(await getEventLedgerEntries(event.id))
      const res = await supaPost('rpc/attend_settle_event', {
        p_args: { event_id: event.id, amount_cents: net },
      })
      if (!res.ok) {
        console.error(
          `[settlement] attend_settle_event failed for ${event.id}: ` +
            `${res.status} ${await res.text()}`,
        )
        continue
      }
      const result = (await res.json()) as { settled?: boolean }
      if (result.settled) settled += 1
    } catch (err) {
      console.error(`[settlement] error settling ${event.id}:`, (err as Error).message)
    }
  }
  return { scanned: events.length, settled }
}

/** Release pass — pay out every matured HELD payout with no open dispute. */
export async function releaseMaturedPayouts(): Promise<{
  scanned: number
  released: number
  skipped: number
}> {
  const due = await listDuePayouts()
  let released = 0
  let skipped = 0
  for (const payout of due) {
    try {
      if (await hasOpenDispute(payout.event_id)) {
        // §16: a disputed event's funds stay held — retried once it resolves.
        skipped += 1
        continue
      }

      // Recompute the net now, so refunds / chargebacks during the hold window
      // are reflected; never transfer a negative amount.
      const net = Math.max(0, computeArtistNet(await getEventLedgerEntries(payout.event_id)))

      let transferId: string | null = null
      if (net > 0) {
        const account = payout.attend_payout_accounts
        if (!account?.payouts_enabled || !account.stripe_connect_account_id) {
          // The Connect account is not ready — leave HELD, retry next run.
          console.error(`[settlement] payout ${payout.id}: Connect account not ready`)
          skipped += 1
          continue
        }
        const transfer = await attendStripe().transfers.create(
          { amount: net, currency: 'usd', destination: account.stripe_connect_account_id },
          { idempotencyKey: `attend-payout-${payout.id}` },
        )
        transferId = transfer.id
      }

      const res = await supaPost('rpc/attend_release_payout', {
        p_args: {
          payout_id: payout.id,
          final_amount_cents: net,
          stripe_transfer_id: transferId,
        },
      })
      if (!res.ok) {
        console.error(
          `[settlement] attend_release_payout failed for ${payout.id}: ` +
            `${res.status} ${await res.text()}`,
        )
        skipped += 1
        continue
      }
      // A concurrent run may already have released it (already_done) — that is
      // not a release this run performed, so it is not counted.
      const result = (await res.json()) as { already_done?: boolean }
      if (result.already_done) skipped += 1
      else released += 1
    } catch (err) {
      console.error(`[settlement] error releasing ${payout.id}:`, (err as Error).message)
      skipped += 1
    }
  }
  return { scanned: due.length, released, skipped }
}

/** The creator's payouts, for their read-only payouts page. */
export async function listCreatorPayouts(creatorId: string): Promise<CreatorPayoutRow[]> {
  return getCreatorPayouts(creatorId)
}
