// The HYVE Attend fee calculator (spec §9.1, §30) — the single source of
// pricing truth. Pure: no database, no Stripe. Integer cents only.

import { percentOf } from '@/lib/attend/money'

export type ShowType =
  | 'HUMAN_LIVE_BROADCAST'
  | 'AI_SCHEDULED_PERFORMANCE'
  | 'HYBRID_HUMAN_AI'
  | 'PRIVATE_EVENT'
  | 'FREE_EVENT'

export type FeeMode = 'ABSORB' | 'PASS_TO_BUYER'

export interface FeeInput {
  showType: ShowType
  ticketSubtotalCents: number
  /** Reserved — callers pass an already-summed subtotal; unused in Phase 1. */
  quantity: number
  feeMode: FeeMode
  /**
   * Optional: a known/real processor fee (e.g. from a Stripe balance
   * transaction during post-charge reconciliation). When omitted, the
   * Stripe US-card estimate (2.9% + 30c) is computed.
   */
  processorFeeEstimateCents?: number
  taxEstimateCents: number
  discountsCents: number
  currency: string
}

export interface FeeBreakdown {
  ticketSubtotalCents: number
  hyvePlatformFeeCents: number
  processorFeeCents: number
  taxCents: number
  buyerTotalCents: number
  artistGrossCents: number
  artistNetEstimateCents: number
  promotionRegistrationFeeCents: number
}

const HYVE_FEE_PERCENT: Record<ShowType, number> = {
  HUMAN_LIVE_BROADCAST: 2.5,
  PRIVATE_EVENT: 2.5,
  FREE_EVENT: 2.5,
  HYBRID_HUMAN_AI: 5.5,
  AI_SCHEDULED_PERFORMANCE: 5.5,
}

const STRIPE_PERCENT = 2.9
const STRIPE_FIXED_CENTS = 30
const REGISTRATION_FEE_CENTS = 5_000

export function calculateFees(input: FeeInput): FeeBreakdown {
  const subtotal = Math.max(0, input.ticketSubtotalCents - input.discountsCents)

  const hyvePlatformFeeCents = percentOf(subtotal, HYVE_FEE_PERCENT[input.showType])
  const processorFeeCents =
    input.processorFeeEstimateCents ??
    (subtotal > 0 ? percentOf(subtotal, STRIPE_PERCENT) + STRIPE_FIXED_CENTS : 0)
  const taxCents = input.taxEstimateCents

  // ABSORB: the artist absorbs fees, the buyer pays the ticket subtotal (+ tax).
  // PASS_TO_BUYER: fees are added on top of the subtotal.
  const buyerTotalCents =
    input.feeMode === 'ABSORB'
      ? subtotal + taxCents
      : subtotal + hyvePlatformFeeCents + processorFeeCents + taxCents

  const artistGrossCents = subtotal
  const artistNetEstimateCents =
    input.feeMode === 'ABSORB'
      ? subtotal - hyvePlatformFeeCents - processorFeeCents
      : subtotal

  const isPaid = subtotal > 0
  const promotionRegistrationFeeCents = isPaid ? REGISTRATION_FEE_CENTS : 0

  return {
    ticketSubtotalCents: subtotal,
    hyvePlatformFeeCents,
    processorFeeCents,
    taxCents,
    buyerTotalCents,
    artistGrossCents,
    artistNetEstimateCents,
    promotionRegistrationFeeCents,
  }
}
