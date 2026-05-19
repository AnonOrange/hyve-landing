// HYVE Attend promotion — the engine on top of the registration-fee campaign
// (spec §19). The starter creative is generated lazily the first time the
// creator opens their promotion dashboard; internal placements are free, so
// the $50 budget stays whole and reserved for external ad spend.
import { generateStarterCreative } from '@/lib/attend/promotion/promotion-copy'
import {
  getCampaignByEvent,
  updateCampaign,
  getFeaturedCampaigns,
  getInternalSpend,
  countSoldTickets,
  type CampaignRow,
} from '@/lib/attend/promotion/promotion-repository'
import { getCreatorEvent, NotFoundError } from '@/lib/attend/events/service'
import type { EventRow } from '@/lib/attend/events/repository'
import { supaPost } from '@/lib/supabase'

export interface PromotionDashboard {
  campaignId: string
  headline: string
  body: string
  creativeApproved: boolean
  budgetCents: number
  impressions: number
  clicks: number
  conversions: number
}

export interface FeaturedEvent {
  campaignId: string
  headline: string | null
  event: EventRow
}

/**
 * The creator's promotion dashboard for one of their events. The starter
 * creative is generated and persisted on first view.
 */
export async function getPromotionDashboard(
  eventId: string,
  creatorId: string,
): Promise<PromotionDashboard> {
  const event = await getCreatorEvent(eventId, creatorId) // throws if not theirs
  let campaign = await getCampaignByEvent(eventId)
  if (!campaign) throw new NotFoundError('This event has no promotion campaign')

  campaign = await ensureCreative(campaign, event)
  const [spend, conversions] = await Promise.all([
    getInternalSpend(campaign.id),
    countSoldTickets(eventId),
  ])

  return {
    campaignId: campaign.id,
    headline: campaign.headline ?? '',
    body: campaign.body ?? '',
    creativeApproved: campaign.creative_approved,
    budgetCents: campaign.budget_cents,
    impressions: spend.impressions,
    clicks: spend.clicks,
    conversions,
  }
}

// Generate + persist the starter creative if the campaign has none yet. Two
// concurrent first-views can both generate and write — harmless: the generator
// is pure, so last-write-wins produces the identical creative.
async function ensureCreative(campaign: CampaignRow, event: EventRow): Promise<CampaignRow> {
  if (campaign.headline && campaign.body) return campaign
  const creative = generateStarterCreative({
    title: event.title,
    description: event.description,
  })
  await updateCampaign(campaign.id, { headline: creative.headline, body: creative.body })
  return { ...campaign, headline: creative.headline, body: creative.body }
}

/** Save the creator's edited creative for one of their events. */
export async function savePromotionCreative(
  eventId: string,
  creatorId: string,
  input: { headline: string; body: string; approved: boolean },
): Promise<void> {
  await getCreatorEvent(eventId, creatorId) // throws if not theirs
  const campaign = await getCampaignByEvent(eventId)
  if (!campaign) throw new NotFoundError('This event has no promotion campaign')
  await updateCampaign(campaign.id, {
    headline: input.headline.trim().slice(0, 200) || null,
    body: input.body.trim().slice(0, 600) || null,
    creative_approved: input.approved,
  })
}

/** The featured events for the discovery page. */
export async function getFeaturedEvents(): Promise<FeaturedEvent[]> {
  const campaigns = await getFeaturedCampaigns()
  return campaigns.map((c) => ({
    campaignId: c.id,
    headline: c.headline,
    event: c.attend_events,
  }))
}

/** Record one impression per campaign id (the discovery Featured-row beacon). */
export async function recordImpressions(campaignIds: string[]): Promise<void> {
  for (const id of campaignIds) {
    try {
      const res = await supaPost('rpc/attend_track_promotion', {
        p_args: { campaign_id: id, metric: 'impressions' },
      })
      if (!res.ok) console.error(`[promotion] impression failed for ${id}: ${res.status}`)
    } catch (err) {
      console.error('[promotion] impression error:', (err as Error).message)
    }
  }
}

/** Record one click on a campaign (the featured-card redirect). */
export async function recordClick(campaignId: string): Promise<void> {
  try {
    const res = await supaPost('rpc/attend_track_promotion', {
      p_args: { campaign_id: campaignId, metric: 'clicks' },
    })
    if (!res.ok) console.error(`[promotion] click failed for ${campaignId}: ${res.status}`)
  } catch (err) {
    console.error('[promotion] click error:', (err as Error).message)
  }
}
