// Shared Stripe client for HYVE Attend. One construction site so the
// registration checkout, Connect onboarding, and webhook all share it.
import Stripe from 'stripe'

/** The flat $50 show-registration fee, in integer cents (spec §5). */
export const REGISTRATION_FEE_CENTS = 5000

export function attendStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}
