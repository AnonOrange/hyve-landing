import { describe, it, expect } from 'vitest'
import { calculateFees } from '@/lib/attend/payments/fee-calculator'

describe('calculateFees — human show', () => {
  it('computes a $25 human ticket all-in (ABSORB mode)', () => {
    const r = calculateFees({
      showType: 'HUMAN_LIVE_BROADCAST',
      ticketSubtotalCents: 2_500,
      quantity: 1,
      feeMode: 'ABSORB',
      taxEstimateCents: 0,
      discountsCents: 0,
      currency: 'usd',
    })
    expect(r.ticketSubtotalCents).toBe(2_500)
    expect(r.hyvePlatformFeeCents).toBe(63)      // 2.5% of 2500, round half up
    expect(r.processorFeeCents).toBe(103)        // 2.9% of 2500 + 30
    expect(r.buyerTotalCents).toBe(2_500)        // ABSORB: buyer pays subtotal only
    expect(r.artistGrossCents).toBe(2_500)
    expect(r.artistNetEstimateCents).toBe(2_334) // 2500 - 63 - 103
  })

  it('PASS_TO_BUYER adds fees on top of the subtotal', () => {
    const r = calculateFees({
      showType: 'HUMAN_LIVE_BROADCAST',
      ticketSubtotalCents: 2_500,
      quantity: 1,
      feeMode: 'PASS_TO_BUYER',
      taxEstimateCents: 0,
      discountsCents: 0,
      currency: 'usd',
    })
    expect(r.buyerTotalCents).toBe(2_666)        // 2500 + 63 + 103
    expect(r.artistNetEstimateCents).toBe(2_500) // artist keeps the full subtotal
  })
})

describe('calculateFees — AI show', () => {
  it('uses the 5.5% platform fee', () => {
    const r = calculateFees({
      showType: 'AI_SCHEDULED_PERFORMANCE',
      ticketSubtotalCents: 2_500,
      quantity: 1,
      feeMode: 'ABSORB',
      taxEstimateCents: 0,
      discountsCents: 0,
      currency: 'usd',
    })
    expect(r.hyvePlatformFeeCents).toBe(138)     // 5.5% of 2500
  })
})

describe('calculateFees — registration fee', () => {
  it('is 5000c for a paid show and 0 for a free show', () => {
    const paid = calculateFees({
      showType: 'HUMAN_LIVE_BROADCAST', ticketSubtotalCents: 2_500, quantity: 1,
      feeMode: 'ABSORB', taxEstimateCents: 0, discountsCents: 0, currency: 'usd',
    })
    expect(paid.promotionRegistrationFeeCents).toBe(5_000)

    const free = calculateFees({
      showType: 'FREE_EVENT', ticketSubtotalCents: 0, quantity: 1,
      feeMode: 'ABSORB', taxEstimateCents: 0, discountsCents: 0, currency: 'usd',
    })
    expect(free.promotionRegistrationFeeCents).toBe(0)
  })
})

describe('calculateFees — beta waiver (waivePlatformFee)', () => {
  it('zeroes the platform fee so the artist keeps everything but Stripe (ABSORB)', () => {
    const r = calculateFees({
      showType: 'HUMAN_LIVE_BROADCAST',
      ticketSubtotalCents: 2_500,
      quantity: 1,
      feeMode: 'ABSORB',
      taxEstimateCents: 0,
      discountsCents: 0,
      currency: 'usd',
      waivePlatformFee: true,
    })
    expect(r.hyvePlatformFeeCents).toBe(0)        // HYVE takes nothing in beta
    expect(r.processorFeeCents).toBe(103)         // Stripe's fee is never waived
    expect(r.buyerTotalCents).toBe(2_500)         // buyer still pays the ticket price
    expect(r.artistNetEstimateCents).toBe(2_397)  // 2500 - 0 - 103
    expect(r.promotionRegistrationFeeCents).toBe(0) // $50 registration also waived
  })

  it('drops the platform fee off the buyer total under PASS_TO_BUYER', () => {
    const r = calculateFees({
      showType: 'AI_SCHEDULED_PERFORMANCE',
      ticketSubtotalCents: 2_500,
      quantity: 1,
      feeMode: 'PASS_TO_BUYER',
      taxEstimateCents: 0,
      discountsCents: 0,
      currency: 'usd',
      waivePlatformFee: true,
    })
    expect(r.hyvePlatformFeeCents).toBe(0)        // even the 5.5% AI fee is waived
    expect(r.buyerTotalCents).toBe(2_603)         // 2500 + 0 hyve + 103 processor
    expect(r.artistNetEstimateCents).toBe(2_500)
  })
})

describe('calculateFees — tax and discounts', () => {
  it('adds tax to the buyer total and subtracts discounts from the subtotal', () => {
    const r = calculateFees({
      showType: 'HUMAN_LIVE_BROADCAST',
      ticketSubtotalCents: 5_000,
      quantity: 2,
      feeMode: 'ABSORB',
      taxEstimateCents: 200,
      discountsCents: 500,
      currency: 'usd',
    })
    expect(r.ticketSubtotalCents).toBe(4_500)    // 5000 - 500 discount
    expect(r.taxCents).toBe(200)
    expect(r.buyerTotalCents).toBe(4_700)        // 4500 + 200 tax (ABSORB)
  })
})

describe('calculateFees — processor fee override', () => {
  it('uses a supplied processorFeeEstimateCents instead of the computed estimate', () => {
    const r = calculateFees({
      showType: 'HUMAN_LIVE_BROADCAST',
      ticketSubtotalCents: 2_500,
      quantity: 1,
      feeMode: 'PASS_TO_BUYER',
      processorFeeEstimateCents: 120,
      taxEstimateCents: 0,
      discountsCents: 0,
      currency: 'usd',
    })
    expect(r.processorFeeCents).toBe(120)
    expect(r.buyerTotalCents).toBe(2_683)        // 2500 + 63 hyve + 120 processor
  })
})
