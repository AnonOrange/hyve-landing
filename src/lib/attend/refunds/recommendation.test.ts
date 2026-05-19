import { describe, it, expect } from 'vitest'
import { recommendRefund, type RefundEvidence } from '@/lib/attend/refunds/recommendation'

// A fully-negative baseline; each test flips only the fields under test.
const base: RefundEvidence = {
  eventCancelled: false,
  artistNoShow: false,
  duplicateCharge: false,
  platformOutage: false,
  attended: false,
  eventEnded: false,
  wasTransferred: false,
}

describe('recommendRefund', () => {
  it('approves a cancelled event', () => {
    expect(recommendRefund({ ...base, eventCancelled: true })).toBe('APPROVE')
  })

  it('approves an artist no-show', () => {
    expect(recommendRefund({ ...base, artistNoShow: true, eventEnded: true })).toBe('APPROVE')
  })

  it('approves a duplicate charge', () => {
    expect(recommendRefund({ ...base, duplicateCharge: true })).toBe('APPROVE')
  })

  it('sends a platform outage to human review', () => {
    expect(recommendRefund({ ...base, platformOutage: true })).toBe('NEEDS_HUMAN')
  })

  it('sends a brief watch during an outage to review, not deny', () => {
    // §31: "entered for 30 seconds but global outage occurred" — review.
    expect(
      recommendRefund({ ...base, attended: true, platformOutage: true, eventEnded: true }),
    ).toBe('NEEDS_HUMAN')
  })

  it('denies a request from someone who attended the show', () => {
    // §31: "entered room and watched 80% of show" — deny.
    expect(recommendRefund({ ...base, attended: true, eventEnded: true })).toBe('DENY')
  })

  it('denies a no-show for an event that ran normally', () => {
    // §31: "never entered and did not cancel before cutoff" — deny.
    expect(recommendRefund({ ...base, eventEnded: true })).toBe('DENY')
  })

  it('sends an upcoming event to human review', () => {
    // Not attended, event not yet held — a reviewer applies event policy.
    expect(recommendRefund(base)).toBe('NEEDS_HUMAN')
  })

  it('lets a cancelled event override attendance', () => {
    expect(
      recommendRefund({ ...base, eventCancelled: true, attended: true, eventEnded: true }),
    ).toBe('APPROVE')
  })

  it('sends a transferred ticket to human review', () => {
    // §31: transferred-and-accepted refund rules are nuanced — a reviewer decides.
    expect(recommendRefund({ ...base, wasTransferred: true, eventEnded: true })).toBe(
      'NEEDS_HUMAN',
    )
  })

  it('still approves a cancelled event even if the ticket was transferred', () => {
    expect(recommendRefund({ ...base, wasTransferred: true, eventCancelled: true })).toBe(
      'APPROVE',
    )
  })
})
