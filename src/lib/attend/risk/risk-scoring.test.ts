import { describe, it, expect } from 'vitest'
import { scoreEvent, type EventRiskInput } from '@/lib/attend/risk/risk-scoring'

// An established, fully-verified, low-risk event.
const clean: EventRiskInput = {
  priorEventCount: 5,
  maxTicketPriceCents: 3000,
  streamTested: true,
  payoutVerified: true,
  priorDisputeCount: 0,
  priorRefundCount: 0,
  hoursListedToStart: 720,
}

describe('scoreEvent', () => {
  it('scores a clean established event as LOW with score 0', () => {
    const r = scoreEvent(clean)
    expect(r.score).toBe(0)
    expect(r.band).toBe('LOW')
  })

  it('adds a factor for a brand-new organizer', () => {
    const r = scoreEvent({ ...clean, priorEventCount: 0 })
    expect(r.factors.newOrganizer).toBe(20)
    expect(r.band).toBe('LOW')
  })

  it('reaches MEDIUM for a new organizer with no stream test', () => {
    const r = scoreEvent({ ...clean, priorEventCount: 0, streamTested: false })
    expect(r.score).toBe(40)
    expect(r.band).toBe('MEDIUM')
  })

  it('reaches HIGH for a new, untested, unverified event with a prior dispute', () => {
    const r = scoreEvent({
      ...clean,
      priorEventCount: 0,
      streamTested: false,
      payoutVerified: false,
      priorDisputeCount: 1,
    })
    expect(r.band).toBe('HIGH')
  })

  it('flags a high ticket price and short notice', () => {
    const r = scoreEvent({ ...clean, maxTicketPriceCents: 20000, hoursListedToStart: 12 })
    expect(r.factors.highTicketPrice).toBe(15)
    expect(r.factors.shortNotice).toBe(10)
  })

  it('scales the dispute factor but caps it', () => {
    expect(scoreEvent({ ...clean, priorDisputeCount: 1 }).factors.priorDisputes).toBe(12)
    expect(scoreEvent({ ...clean, priorDisputeCount: 9 }).factors.priorDisputes).toBe(25)
  })

  it('caps the total score at 100', () => {
    const r = scoreEvent({
      priorEventCount: 0,
      maxTicketPriceCents: 99999,
      streamTested: false,
      payoutVerified: false,
      priorDisputeCount: 20,
      priorRefundCount: 20,
      hoursListedToStart: 1,
    })
    expect(r.score).toBe(100)
    expect(r.band).toBe('HIGH')
  })
})
