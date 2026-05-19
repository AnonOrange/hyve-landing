// HYVE Attend settlement math — the artist's payout is the net of their
// balance-affecting ledger entries (spec §16 / §30). Pure and deterministic:
// all money is integer cents.

export interface LedgerEntry {
  type: string
  amount_cents: number
}

// The ledger entry types that make up the artist's net balance. TICKET_GROSS,
// HYVE_PLATFORM_FEE, PROCESSOR_FEE_ESTIMATE and TAX_COLLECTED are the
// accounting breakdown that ARTIST_NET_PENDING already nets out; PROMOTION_* is
// the separate registration / ad-budget flow; PAYOUT_* is the disbursement
// itself. This set MUST stay in sync with attend_settle_event's caller.
const ARTIST_NET_TYPES = new Set([
  'ARTIST_NET_PENDING',
  'REFUND_DEBIT',
  'CHARGEBACK_DEBIT',
  'DISPUTE_HOLD',
  'ADJUSTMENT',
])

/** The artist's net payable, in integer cents, from an event's ledger entries. */
export function computeArtistNet(entries: LedgerEntry[]): number {
  return entries
    .filter((e) => ARTIST_NET_TYPES.has(e.type))
    .reduce((sum, e) => sum + e.amount_cents, 0)
}
