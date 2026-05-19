// Raw-REST data access for HYVE Attend payouts & settlement. Query-only — no
// business logic. Server-side only (service-key reads).
import { supaGet } from '@/lib/supabase'
import type { LedgerEntry } from '@/lib/attend/payouts/settlement-math'

// A held payout that has reached its release date, with the creator's Connect
// account embedded so the release can transfer without a second query.
export interface DuePayoutRow {
  id: string
  event_id: string
  amount_cents: number
  attend_payout_accounts: {
    stripe_connect_account_id: string
    payouts_enabled: boolean
  } | null
}

// One row of the creator's payouts page.
export interface CreatorPayoutRow {
  id: string
  amount_cents: number
  status: string
  scheduled_release_at: string | null
  released_at: string | null
  created_at: string
  attend_events: { title: string } | null
}

/** Every ledger entry for an event — fed to computeArtistNet. */
export async function getEventLedgerEntries(eventId: string): Promise<LedgerEntry[]> {
  const res = await supaGet(
    'attend_ledger_entries',
    `event_id=eq.${eventId}&select=type,amount_cents`,
  )
  if (!res.ok) throw new Error(`attend_ledger_entries query failed: ${res.status}`)
  return (await res.json()) as LedgerEntry[]
}

/** HELD payouts whose hold window has elapsed, with the Connect account embedded. */
export async function listDuePayouts(): Promise<DuePayoutRow[]> {
  const nowIso = new Date().toISOString()
  const res = await supaGet(
    'attend_payouts',
    `status=eq.HELD&scheduled_release_at=lte.${nowIso}` +
      `&select=id,event_id,amount_cents,` +
      `attend_payout_accounts(stripe_connect_account_id,payouts_enabled)`,
  )
  if (!res.ok) throw new Error(`attend_payouts due query failed: ${res.status}`)
  return (await res.json()) as DuePayoutRow[]
}

/** True if the event has a card dispute that is not yet terminally resolved. */
export async function hasOpenDispute(eventId: string): Promise<boolean> {
  const res = await supaGet(
    'attend_disputes',
    `event_id=eq.${eventId}&status=not.in.(WON,LOST)&select=id`,
  )
  if (!res.ok) throw new Error(`attend_disputes query failed: ${res.status}`)
  return ((await res.json()) as unknown[]).length > 0
}

/** The creator's payouts across all their events, newest first. */
export async function getCreatorPayouts(creatorId: string): Promise<CreatorPayoutRow[]> {
  const res = await supaGet(
    'attend_payouts',
    `select=id,amount_cents,status,scheduled_release_at,released_at,created_at,` +
      `attend_events!inner(title,creator_id)&attend_events.creator_id=eq.${creatorId}` +
      `&order=created_at.desc`,
  )
  if (!res.ok) throw new Error(`attend_payouts creator query failed: ${res.status}`)
  return (await res.json()) as CreatorPayoutRow[]
}
