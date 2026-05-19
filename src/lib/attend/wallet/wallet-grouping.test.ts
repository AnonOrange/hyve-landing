import { describe, it, expect } from 'vitest'
import { groupOwnedTickets } from '@/lib/attend/wallet/wallet-grouping'
import type { OwnedTicket } from '@/lib/attend/ticketing/ticket-repository'

function tk(over: Partial<OwnedTicket> & { eventId: string }): OwnedTicket {
  const { eventId, ...rest } = over
  return {
    id: 'tk-1',
    state: 'ASSIGNED_TO_BUYER',
    access_token: 'tok-1',
    created_at: '2026-01-01T00:00:00Z',
    attend_events: {
      id: eventId,
      title: `Event ${eventId}`,
      slug: `event-${eventId}`,
      starts_at: '2026-06-01T20:00:00Z',
      status: 'ON_SALE',
    },
    attend_ticket_types: { name: 'GA', kind: 'GENERAL_ADMISSION' },
    ...rest,
  }
}

describe('groupOwnedTickets', () => {
  it('returns one group per event carrying that event and its tickets', () => {
    const groups = groupOwnedTickets([
      tk({ eventId: 'e1', id: 't1' }),
      tk({ eventId: 'e2', id: 't2' }),
      tk({ eventId: 'e1', id: 't3' }),
    ])
    expect(groups).toHaveLength(2)
    expect(groups[0].event.id).toBe('e1')
    expect(groups[0].tickets.map((t) => t.id)).toEqual(['t1', 't3'])
    expect(groups[1].event.id).toBe('e2')
    expect(groups[1].tickets.map((t) => t.id)).toEqual(['t2'])
  })

  it('returns an empty array for no tickets', () => {
    expect(groupOwnedTickets([])).toEqual([])
  })

  it('preserves first-seen event order', () => {
    const groups = groupOwnedTickets([
      tk({ eventId: 'z', id: 't1' }),
      tk({ eventId: 'a', id: 't2' }),
    ])
    expect(groups.map((g) => g.event.id)).toEqual(['z', 'a'])
  })
})
