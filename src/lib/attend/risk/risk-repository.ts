// Raw-REST data access for HYVE Attend risk scoring. Gathers the §26 event
// signals and persists computed scores. Server-side only (service-key reads).
import { supaGet, supaPost } from '@/lib/supabase'
import type { EventRiskInput, RiskAssessment } from '@/lib/attend/risk/risk-scoring'

interface EventRow {
  creator_id: string
  starts_at: string | null
  created_at: string
}

/**
 * Gather the observable §26 risk signals for one event. Returns null if the
 * event does not exist (or is soft-deleted).
 */
export async function gatherEventRiskInput(eventId: string): Promise<EventRiskInput | null> {
  const eventRes = await supaGet(
    'attend_events',
    `id=eq.${eventId}&deleted_at=is.null&select=creator_id,starts_at,created_at`,
  )
  if (!eventRes.ok) throw new Error(`attend_events risk query failed: ${eventRes.status}`)
  const event = ((await eventRes.json()) as EventRow[])[0]
  if (!event) return null

  // The creator's events (this one excluded) — the "new organizer" signal and
  // the id set for the dispute / refund history counts.
  const creatorEvents = await idList(
    'attend_events',
    `creator_id=eq.${event.creator_id}&id=neq.${eventId}&deleted_at=is.null&select=id`,
  )

  const [maxPrice, streamTested, payoutVerified, disputeCount, refundCount] = await Promise.all([
    maxTicketPrice(eventId),
    hasPassedStreamTest(eventId),
    creatorPayoutVerified(event.creator_id),
    historyCount('attend_disputes', creatorEvents),
    historyCount('attend_refund_requests', creatorEvents),
  ])

  const listedAt = new Date(event.created_at).getTime()
  const startsAt = event.starts_at ? new Date(event.starts_at).getTime() : listedAt
  const hoursListedToStart = Math.max(0, (startsAt - listedAt) / 3_600_000)

  return {
    priorEventCount: creatorEvents.length,
    maxTicketPriceCents: maxPrice,
    streamTested,
    payoutVerified,
    priorDisputeCount: disputeCount,
    priorRefundCount: refundCount,
    hoursListedToStart,
  }
}

/** Persist a computed risk score for an event (a row in the §26 history table). */
export async function recordEventRisk(
  eventId: string,
  assessment: RiskAssessment,
): Promise<void> {
  const res = await supaPost('attend_risk_scores', {
    subject_type: 'EVENT',
    subject_id: eventId,
    score: assessment.score,
    factors: { band: assessment.band, ...assessment.factors },
  })
  if (!res.ok) {
    console.error(`[risk] failed to record score for ${eventId}: ${res.status}`)
  }
}

async function idList(table: string, query: string): Promise<string[]> {
  const res = await supaGet(table, query)
  if (!res.ok) throw new Error(`${table} query failed: ${res.status}`)
  return ((await res.json()) as { id: string }[]).map((r) => r.id)
}

async function maxTicketPrice(eventId: string): Promise<number> {
  const res = await supaGet(
    'attend_ticket_types',
    `event_id=eq.${eventId}&select=price_cents&order=price_cents.desc&limit=1`,
  )
  if (!res.ok) throw new Error(`attend_ticket_types risk query failed: ${res.status}`)
  const rows = (await res.json()) as { price_cents: number }[]
  return rows[0]?.price_cents ?? 0
}

async function hasPassedStreamTest(eventId: string): Promise<boolean> {
  const res = await supaGet(
    'attend_streams',
    `event_id=eq.${eventId}&select=test_passed_at`,
  )
  if (!res.ok) throw new Error(`attend_streams risk query failed: ${res.status}`)
  const rows = (await res.json()) as { test_passed_at: string | null }[]
  return rows[0]?.test_passed_at != null
}

async function creatorPayoutVerified(creatorId: string): Promise<boolean> {
  const res = await supaGet(
    'attend_payout_accounts',
    `profile_id=eq.${creatorId}&select=payouts_enabled`,
  )
  if (!res.ok) throw new Error(`attend_payout_accounts risk query failed: ${res.status}`)
  const rows = (await res.json()) as { payouts_enabled: boolean }[]
  return rows[0]?.payouts_enabled ?? false
}

// Count rows of `table` whose event_id is in the creator's other events.
async function historyCount(table: string, eventIds: string[]): Promise<number> {
  if (eventIds.length === 0) return 0
  const res = await supaGet(table, `event_id=in.(${eventIds.join(',')})&select=id`)
  if (!res.ok) throw new Error(`${table} risk count failed: ${res.status}`)
  return ((await res.json()) as unknown[]).length
}
