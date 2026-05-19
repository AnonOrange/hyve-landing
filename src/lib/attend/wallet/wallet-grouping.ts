// HYVE Attend wallet — pure grouping of a buyer's owned tickets by event.
import type { OwnedTicket } from '@/lib/attend/ticketing/ticket-repository'

export interface WalletEventGroup {
  event: OwnedTicket['attend_events']
  tickets: OwnedTicket[]
}

/** Group a buyer's owned tickets by their event, preserving input order. */
export function groupOwnedTickets(tickets: OwnedTicket[]): WalletEventGroup[] {
  const groups: WalletEventGroup[] = []
  const byEventId = new Map<string, WalletEventGroup>()
  for (const t of tickets) {
    let g = byEventId.get(t.attend_events.id)
    if (!g) {
      g = { event: t.attend_events, tickets: [] }
      byEventId.set(t.attend_events.id, g)
      groups.push(g)
    }
    g.tickets.push(t)
  }
  return groups
}
