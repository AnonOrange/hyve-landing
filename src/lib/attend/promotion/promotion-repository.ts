// Raw-REST data access for the HYVE Attend promotion tables. Query-only — no
// business logic. Server-side only (service-key reads).
import { supaGet, supaPatch } from '@/lib/supabase'
import { DISCOVERABLE_STATUSES } from '@/lib/attend/events/lifecycle'
import type { EventRow } from '@/lib/attend/events/repository'

export interface CampaignRow {
  id: string
  event_id: string
  budget_cents: number
  status: string
  headline: string | null
  body: string | null
  creative_approved: boolean
}

// An ACTIVE campaign with its (discoverable) event embedded — a featured slot.
export interface FeaturedCampaign {
  id: string
  headline: string | null
  attend_events: EventRow
}

export interface InternalSpend {
  impressions: number
  clicks: number
}

export async function getCampaignByEvent(eventId: string): Promise<CampaignRow | null> {
  const res = await supaGet(
    'attend_promotion_campaigns',
    `event_id=eq.${eventId}&select=id,event_id,budget_cents,status,headline,body,creative_approved`,
  )
  if (!res.ok) throw new Error(`attend_promotion_campaigns query failed: ${res.status}`)
  const rows = (await res.json()) as CampaignRow[]
  return rows[0] ?? null
}

export async function updateCampaign(
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const res = await supaPatch('attend_promotion_campaigns', `id=eq.${id}`, {
    ...patch,
    updated_at: new Date().toISOString(),
  })
  if (!res.ok) {
    throw new Error(`attend_promotion_campaigns update failed: ${res.status} ${await res.text()}`)
  }
}

/** ACTIVE campaigns whose event is public and in a buyer-discoverable status. */
export async function getFeaturedCampaigns(): Promise<FeaturedCampaign[]> {
  const res = await supaGet(
    'attend_promotion_campaigns',
    `status=eq.ACTIVE&select=id,headline,attend_events!inner(*)` +
      `&attend_events.status=in.(${DISCOVERABLE_STATUSES.join(',')})` +
      `&attend_events.visibility=eq.PUBLIC&attend_events.deleted_at=is.null`,
  )
  if (!res.ok) throw new Error(`featured campaigns query failed: ${res.status}`)
  return (await res.json()) as FeaturedCampaign[]
}

/** The campaign's internal-placement counters, or zeroes if none recorded yet. */
export async function getInternalSpend(campaignId: string): Promise<InternalSpend> {
  const res = await supaGet(
    'attend_promotion_spend',
    `campaign_id=eq.${campaignId}&kind=eq.INTERNAL_PLACEMENT&select=impressions,clicks`,
  )
  if (!res.ok) throw new Error(`attend_promotion_spend query failed: ${res.status}`)
  const rows = (await res.json()) as InternalSpend[]
  return rows[0] ?? { impressions: 0, clicks: 0 }
}

/** Count of tickets sold for an event — the conversions proxy (no cart holds). */
export async function countSoldTickets(eventId: string): Promise<number> {
  const res = await supaGet(
    'attend_tickets',
    `event_id=eq.${eventId}&state=in.(PURCHASED,ASSIGNED_TO_BUYER,` +
      `TRANSFER_PENDING_EMAIL,TRANSFER_PENDING_FRIEND_CODE,TRANSFER_ACCEPTED,` +
      `CHECKED_IN,IN_ROOM,USED,NO_SHOW)&select=id`,
  )
  if (!res.ok) throw new Error(`attend_tickets count query failed: ${res.status}`)
  return ((await res.json()) as unknown[]).length
}
