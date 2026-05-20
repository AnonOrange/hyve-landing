// HYVE Attend — product-wide configuration.
//
// Single source of truth for toggles the founder owns. Imported by both
// server and client code; flipping a value here and shipping a deploy
// is the entire change.

/**
 * Beta-mode toggle.
 *
 * When true, the $50 show-registration fee is suspended for ALL shows
 * (not just the first two). Platform percentages on ticket sales are
 * unaffected — those continue to apply in both states. Set to false at
 * full launch, at which point the existing first-2-free model takes
 * over (see attend_grant_free_registration / FREE_REGISTRATION_CAP).
 *
 * Note: beta-mode events are tracked in attend_events.was_beta_registration
 * separately from was_free_registration, so flipping this to false does
 * NOT burn anyone's welcome-offer credits — every creator still has
 * their full first-2-free allowance on day one of full launch.
 */
export const ATTEND_BETA_MODE = true
