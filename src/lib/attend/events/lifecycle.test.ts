import { describe, it, expect } from 'vitest'
import {
  canTransition,
  assertTransition,
  ALL_STATUSES,
  draftTargetStatus,
} from '@/lib/attend/events/lifecycle'

describe('canTransition', () => {
  it('allows the documented paid-show setup chain', () => {
    expect(canTransition('DRAFT', 'REGISTRATION_PENDING')).toBe(true)
    expect(canTransition('REGISTRATION_PENDING', 'PROMOTION_FEE_PAID')).toBe(true)
    expect(canTransition('PROMOTION_FEE_PAID', 'PAYOUT_SETUP_REQUIRED')).toBe(true)
    expect(canTransition('PAYOUT_SETUP_REQUIRED', 'STREAM_SETUP_REQUIRED')).toBe(true)
    expect(canTransition('STREAM_SETUP_REQUIRED', 'SUBMITTED_FOR_REVIEW')).toBe(true)
  })

  it('allows a free show to skip fee + payout setup', () => {
    expect(canTransition('DRAFT', 'STREAM_SETUP_REQUIRED')).toBe(true)
  })

  it('allows the show-day path and settlement', () => {
    expect(canTransition('PUBLISHED', 'ON_SALE')).toBe(true)
    expect(canTransition('ON_SALE', 'SOUNDCHECK')).toBe(true)
    expect(canTransition('SALES_PAUSED', 'SOUNDCHECK')).toBe(true)
    expect(canTransition('SOUNDCHECK', 'DOORS_OPEN')).toBe(true)
    expect(canTransition('DOORS_OPEN', 'LIVE')).toBe(true)
    expect(canTransition('LIVE', 'ENDED')).toBe(true)
    expect(canTransition('ENDED', 'SETTLEMENT_HOLD')).toBe(true)
    expect(canTransition('SETTLEMENT_HOLD', 'SETTLED')).toBe(true)
  })

  it('allows review rejection back to DRAFT and sales pause/resume', () => {
    expect(canTransition('SUBMITTED_FOR_REVIEW', 'DRAFT')).toBe(true)
    expect(canTransition('ON_SALE', 'SALES_PAUSED')).toBe(true)
    expect(canTransition('SALES_PAUSED', 'ON_SALE')).toBe(true)
  })

  it('allows cancellation from every pre-LIVE state and from LIVE', () => {
    for (const s of ['DRAFT','REGISTRATION_PENDING','PROMOTION_FEE_PAID','PAYOUT_SETUP_REQUIRED',
                      'STREAM_SETUP_REQUIRED','SUBMITTED_FOR_REVIEW','PUBLISHED','ON_SALE',
                      'SALES_PAUSED','SOUNDCHECK','DOORS_OPEN','LIVE'] as const) {
      expect(canTransition(s, 'CANCELLED')).toBe(true)
    }
  })

  it('routes cancellation through refunding or straight to archived', () => {
    expect(canTransition('CANCELLED', 'REFUNDING')).toBe(true)
    expect(canTransition('CANCELLED', 'ARCHIVED')).toBe(true)
    expect(canTransition('REFUNDING', 'SETTLED')).toBe(true)
    expect(canTransition('SETTLED', 'ARCHIVED')).toBe(true)
  })

  it('rejects illegal transitions', () => {
    expect(canTransition('DRAFT', 'LIVE')).toBe(false)
    expect(canTransition('ENDED', 'ON_SALE')).toBe(false)
    expect(canTransition('ARCHIVED', 'DRAFT')).toBe(false)
    expect(canTransition('PUBLISHED', 'SOUNDCHECK')).toBe(false)
  })
})

describe('assertTransition', () => {
  it('throws on an illegal transition', () => {
    expect(() => assertTransition('DRAFT', 'LIVE')).toThrow()
  })
  it('does not throw on a legal transition', () => {
    expect(() => assertTransition('DRAFT', 'REGISTRATION_PENDING')).not.toThrow()
  })
})

describe('ALL_STATUSES', () => {
  it('lists the 18 event statuses', () => {
    expect(ALL_STATUSES).toHaveLength(18)
  })
})

describe('draftTargetStatus', () => {
  it('routes a free event straight to stream setup', () => {
    expect(draftTargetStatus('FREE_EVENT')).toBe('STREAM_SETUP_REQUIRED')
  })
  it('routes a paid show to the registration fee', () => {
    expect(draftTargetStatus('HUMAN_LIVE_BROADCAST')).toBe('REGISTRATION_PENDING')
    expect(draftTargetStatus('PRIVATE_EVENT')).toBe('REGISTRATION_PENDING')
  })
  it('only ever returns a legal successor of DRAFT', () => {
    for (const showType of ['FREE_EVENT', 'HUMAN_LIVE_BROADCAST', 'PRIVATE_EVENT']) {
      expect(canTransition('DRAFT', draftTargetStatus(showType))).toBe(true)
    }
  })
})
