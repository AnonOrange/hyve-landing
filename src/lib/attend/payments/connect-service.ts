// HYVE Attend — Stripe Connect Express onboarding for creator payouts.
import { attendStripe } from '@/lib/attend/payments/stripe'
import { supaGet, supaPost, supaPatch } from '@/lib/supabase'

interface PayoutAccountRow {
  id: string
  profile_id: string
  stripe_connect_account_id: string
  status: string
  charges_enabled: boolean
  payouts_enabled: boolean
}

async function getPayoutAccount(creatorId: string): Promise<PayoutAccountRow | null> {
  const res = await supaGet('attend_payout_accounts', `profile_id=eq.${creatorId}&select=*`)
  if (!res.ok) throw new Error(`attend_payout_accounts query failed: ${res.status}`)
  const rows = (await res.json()) as PayoutAccountRow[]
  return rows[0] ?? null
}

/** True once the creator's Connect account can receive payouts. */
export async function payoutsEnabled(creatorId: string): Promise<boolean> {
  const acct = await getPayoutAccount(creatorId)
  return acct?.payouts_enabled ?? false
}

/**
 * Return the creator's Stripe Connect account id, creating an Express account
 * (and the attend_payout_accounts row) on first call.
 */
export async function getOrCreatePayoutAccount(
  creatorId: string,
  email: string,
): Promise<string> {
  const existing = await getPayoutAccount(creatorId)
  if (existing) return existing.stripe_connect_account_id

  const account = await attendStripe().accounts.create({
    type: 'express',
    email,
    capabilities: { transfers: { requested: true } },
  })

  const res = await supaPost('attend_payout_accounts', {
    profile_id: creatorId,
    stripe_connect_account_id: account.id,
    status: 'ONBOARDING',
    charges_enabled: false,
    payouts_enabled: false,
  })
  if (!res.ok) {
    throw new Error(`attend_payout_accounts insert failed: ${res.status} ${await res.text()}`)
  }
  return account.id
}

/** Create a fresh Stripe-hosted Express onboarding link for the account. */
export async function createOnboardingLink(
  stripeAccountId: string,
  origin: string,
): Promise<string> {
  const link = await attendStripe().accountLinks.create({
    account: stripeAccountId,
    type: 'account_onboarding',
    return_url: `${origin}/api/attend/connect/return`,
    refresh_url: `${origin}/api/attend/connect/refresh`,
  })
  return link.url
}

/** Pull the latest account state from Stripe into attend_payout_accounts. */
export async function syncAccountStatus(stripeAccountId: string): Promise<void> {
  const account = await attendStripe().accounts.retrieve(stripeAccountId)
  const payouts = account.payouts_enabled ?? false
  const res = await supaPatch(
    'attend_payout_accounts',
    `stripe_connect_account_id=eq.${stripeAccountId}`,
    {
      charges_enabled: account.charges_enabled ?? false,
      payouts_enabled: payouts,
      status: payouts ? 'VERIFIED' : 'ONBOARDING',
      updated_at: new Date().toISOString(),
    },
  )
  if (!res.ok) throw new Error(`attend_payout_accounts update failed: ${res.status}`)
}
