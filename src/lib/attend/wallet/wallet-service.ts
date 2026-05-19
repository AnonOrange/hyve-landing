// HYVE Attend wallet service — the buyer's owned tickets, grouped by event.
import { listOwnedTicketsWithContext } from '@/lib/attend/ticketing/ticket-repository'
import { groupOwnedTickets, type WalletEventGroup } from '@/lib/attend/wallet/wallet-grouping'

export type { WalletEventGroup }

export async function getWallet(ownerId: string): Promise<WalletEventGroup[]> {
  return groupOwnedTickets(await listOwnedTicketsWithContext(ownerId))
}
