import { describe, it, expect } from 'vitest'
import { computeArtistNet } from '@/lib/attend/payouts/settlement-math'

describe('computeArtistNet', () => {
  it('is zero for an empty ledger', () => {
    expect(computeArtistNet([])).toBe(0)
  })

  it('sums ARTIST_NET_PENDING entries', () => {
    expect(
      computeArtistNet([
        { type: 'ARTIST_NET_PENDING', amount_cents: 8000 },
        { type: 'ARTIST_NET_PENDING', amount_cents: 4500 },
      ]),
    ).toBe(12500)
  })

  it('subtracts refunds and chargebacks', () => {
    expect(
      computeArtistNet([
        { type: 'ARTIST_NET_PENDING', amount_cents: 10000 },
        { type: 'REFUND_DEBIT', amount_cents: -2500 },
        { type: 'CHARGEBACK_DEBIT', amount_cents: -3000 },
      ]),
    ).toBe(4500)
  })

  it('nets a closed dispute hold to zero', () => {
    expect(
      computeArtistNet([
        { type: 'ARTIST_NET_PENDING', amount_cents: 10000 },
        { type: 'DISPUTE_HOLD', amount_cents: -4000 },
        { type: 'DISPUTE_HOLD', amount_cents: 4000 },
      ]),
    ).toBe(10000)
  })

  it('reflects an open dispute hold as a reduction', () => {
    expect(
      computeArtistNet([
        { type: 'ARTIST_NET_PENDING', amount_cents: 10000 },
        { type: 'DISPUTE_HOLD', amount_cents: -4000 },
      ]),
    ).toBe(6000)
  })

  it('counts ADJUSTMENT entries', () => {
    expect(
      computeArtistNet([
        { type: 'ARTIST_NET_PENDING', amount_cents: 10000 },
        { type: 'ADJUSTMENT', amount_cents: -150 },
      ]),
    ).toBe(9850)
  })

  it('ignores gross, fee, tax, promotion and payout entries', () => {
    expect(
      computeArtistNet([
        { type: 'ARTIST_NET_PENDING', amount_cents: 7000 },
        { type: 'TICKET_GROSS', amount_cents: 10000 },
        { type: 'HYVE_PLATFORM_FEE', amount_cents: 2000 },
        { type: 'PROCESSOR_FEE_ESTIMATE', amount_cents: 600 },
        { type: 'TAX_COLLECTED', amount_cents: 400 },
        { type: 'PROMOTION_REGISTRATION_FEE', amount_cents: 5000 },
        { type: 'PAYOUT_RELEASED', amount_cents: -7000 },
      ]),
    ).toBe(7000)
  })
})
