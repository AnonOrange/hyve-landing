import { describe, it, expect } from 'vitest'
import {
  recommendDisputeResponse,
  isDisputeDueSoon,
  type DisputeEvidence,
} from '@/lib/attend/disputes/dispute-recommendation'

const base: DisputeEvidence = {
  eventCancelled: false,
  artistNoShow: false,
  anyAttended: false,
  eventEnded: false,
}

describe('recommendDisputeResponse', () => {
  it('accepts a dispute on a cancelled event — there is no case to make', () => {
    expect(recommendDisputeResponse({ ...base, eventCancelled: true })).toBe('ACCEPT')
  })

  it('accepts a dispute when the artist no-showed', () => {
    expect(recommendDisputeResponse({ ...base, artistNoShow: true, eventEnded: true })).toBe(
      'ACCEPT',
    )
  })

  it('contests a dispute when the buyer attended the show', () => {
    expect(recommendDisputeResponse({ ...base, anyAttended: true, eventEnded: true })).toBe(
      'CONTEST',
    )
  })

  it('contests a dispute when the event ran and the buyer simply did not attend', () => {
    expect(recommendDisputeResponse({ ...base, eventEnded: true })).toBe('CONTEST')
  })

  it('sends an upcoming event to human review', () => {
    expect(recommendDisputeResponse(base)).toBe('NEEDS_HUMAN')
  })

  it('lets a cancelled event override attendance', () => {
    expect(
      recommendDisputeResponse({ ...base, eventCancelled: true, anyAttended: true }),
    ).toBe('ACCEPT')
  })
})

describe('isDisputeDueSoon', () => {
  const now = new Date('2026-05-19T12:00:00Z')

  it('is true when the deadline is within 48 hours', () => {
    expect(isDisputeDueSoon('2026-05-20T12:00:00Z', now)).toBe(true)
  })

  it('is false when the deadline is comfortably away', () => {
    expect(isDisputeDueSoon('2026-05-25T12:00:00Z', now)).toBe(false)
  })

  it('is false when there is no deadline', () => {
    expect(isDisputeDueSoon(null, now)).toBe(false)
  })

  it('is true when the deadline has already passed', () => {
    expect(isDisputeDueSoon('2026-05-18T12:00:00Z', now)).toBe(true)
  })
})
