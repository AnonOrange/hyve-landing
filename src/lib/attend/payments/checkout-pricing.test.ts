import { describe, it, expect } from 'vitest'
import { priceSelections } from '@/lib/attend/payments/checkout-pricing'
import type { TicketTypeRow } from '@/lib/attend/ticketing/ticket-type-repository'

function tt(over: Partial<TicketTypeRow>): TicketTypeRow {
  return {
    id: 'tt-1',
    event_id: 'ev-1',
    name: 'General Admission',
    kind: 'GENERAL_ADMISSION',
    price_cents: 2500,
    currency: 'usd',
    quantity_total: 100,
    quantity_sold: 0,
    max_per_order: 10,
    sales_start_at: null,
    sales_end_at: null,
    status: 'ACTIVE',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  }
}

describe('priceSelections', () => {
  const ga = tt({ id: 'ga', name: 'GA', price_cents: 2500, max_per_order: 10 })
  const vip = tt({ id: 'vip', name: 'VIP', price_cents: 10000, max_per_order: 4 })

  it('prices a multi-tier selection', () => {
    const r = priceSelections(
      [
        { ticketTypeId: 'ga', quantity: 2 },
        { ticketTypeId: 'vip', quantity: 1 },
      ],
      [ga, vip],
    )
    expect(r.subtotalCents).toBe(2 * 2500 + 10000)
    expect(r.items).toHaveLength(2)
    expect(r.items[0]).toEqual({
      ticketTypeId: 'ga',
      name: 'GA',
      quantity: 2,
      unitPriceCents: 2500,
    })
  })

  it('drops zero-quantity rows', () => {
    const r = priceSelections(
      [
        { ticketTypeId: 'ga', quantity: 0 },
        { ticketTypeId: 'vip', quantity: 1 },
      ],
      [ga, vip],
    )
    expect(r.items).toHaveLength(1)
    expect(r.subtotalCents).toBe(10000)
  })

  it('throws when nothing is selected', () => {
    expect(() => priceSelections([], [ga])).toThrow()
    expect(() => priceSelections([{ ticketTypeId: 'ga', quantity: 0 }], [ga])).toThrow()
  })

  it('throws above max_per_order', () => {
    expect(() => priceSelections([{ ticketTypeId: 'vip', quantity: 5 }], [vip])).toThrow()
  })

  it('throws on an unknown ticket type', () => {
    expect(() => priceSelections([{ ticketTypeId: 'nope', quantity: 1 }], [ga])).toThrow()
  })

  it('throws on a non-ACTIVE tier', () => {
    const paused = tt({ id: 'p', name: 'P', status: 'PAUSED' })
    expect(() => priceSelections([{ ticketTypeId: 'p', quantity: 1 }], [paused])).toThrow()
  })

  it('throws on a non-integer or negative quantity', () => {
    expect(() => priceSelections([{ ticketTypeId: 'ga', quantity: 1.5 }], [ga])).toThrow()
    expect(() => priceSelections([{ ticketTypeId: 'ga', quantity: -1 }], [ga])).toThrow()
  })
})
