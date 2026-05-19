// HYVE Attend checkout pricing — validate a buyer's ticket selection against
// the event's tiers and price it. Pure: no I/O. Inventory availability is not
// checked here — that needs a row lock and is the attend_create_pending_order
// RPC's job; this gives fast, testable, client-facing validation + a subtotal.
import type { TicketTypeRow } from '@/lib/attend/ticketing/ticket-type-repository'
import { ValidationError } from '@/lib/attend/events/service'

export interface Selection {
  ticketTypeId: string
  quantity: number
}

export interface PricedItem {
  ticketTypeId: string
  name: string
  quantity: number
  unitPriceCents: number
}

export interface PricedSelections {
  items: PricedItem[]
  subtotalCents: number
}

export function priceSelections(
  selections: Selection[],
  ticketTypes: TicketTypeRow[],
): PricedSelections {
  const chosen = selections.filter((s) => s.quantity > 0)
  if (chosen.length === 0) throw new ValidationError('Select at least one ticket')

  const items: PricedItem[] = []
  let subtotalCents = 0
  for (const sel of chosen) {
    if (!Number.isInteger(sel.quantity) || sel.quantity < 1) {
      throw new ValidationError('Ticket quantity must be a positive whole number')
    }
    const tt = ticketTypes.find((t) => t.id === sel.ticketTypeId)
    if (!tt) throw new ValidationError('Unknown ticket type')
    if (tt.status !== 'ACTIVE') throw new ValidationError(`${tt.name} is not on sale`)
    if (sel.quantity > tt.max_per_order) {
      throw new ValidationError(`At most ${tt.max_per_order} of "${tt.name}" per order`)
    }
    items.push({
      ticketTypeId: tt.id,
      name: tt.name,
      quantity: sel.quantity,
      unitPriceCents: tt.price_cents,
    })
    subtotalCents += sel.quantity * tt.price_cents
  }
  return { items, subtotalCents }
}
