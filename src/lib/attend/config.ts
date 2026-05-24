// HYVE Attend — product-wide configuration.
//
// Single source of truth for toggles the founder owns. Imported by both
// server and client code; flipping a value here and shipping a deploy
// is the entire change.

/**
 * Beta-mode toggle.
 *
 * When true, HYVE charges creators nothing:
 *   1. the $50 show-registration fee is suspended for ALL shows (not just
 *      the first two) — see attend_grant_beta_registration; and
 *   2. the HYVE platform fee on ticket sales is 0% — checkout-service.ts
 *      passes waivePlatformFee: ATTEND_BETA_MODE into calculateFees, so the
 *      order's stored hyve_fee_cents is 0 and that propagates through the
 *      ARTIST_NET_PENDING ledger entry into settlement. Creators keep 100%
 *      of ticket revenue; only the Stripe processor fee (not ours) applies.
 *
 * Set to false at full launch, at which point the $50 fee + first-2-free
 * model (attend_grant_free_registration / FREE_REGISTRATION_CAP) and the
 * standard platform percentage both resume automatically. The flag gates
 * computation, not stored data, so orders/registrations created during beta
 * keep their 0 values and new ones resume normal pricing.
 *
 * Note: beta-mode events are tracked in attend_events.was_beta_registration
 * separately from was_free_registration, so flipping this to false does
 * NOT burn anyone's welcome-offer credits — every creator still has
 * their full first-2-free allowance on day one of full launch.
 */
export const ATTEND_BETA_MODE = true
