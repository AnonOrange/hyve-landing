// Raw-REST data access for attend_events. Query-only — no business logic.
import { supaGet, supaPost, supaPatch } from '@/lib/supabase'
import { type EventStatus, DISCOVERABLE_STATUSES } from '@/lib/attend/events/lifecycle'

export interface EventRow {
  id: string
  slug: string
  creator_id: string
  title: string
  description: string | null
  show_type: string
  status: EventStatus
  starts_at: string | null
  ends_at: string | null
  timezone: string
  visibility: string
  hero_media_id: string | null
  refund_cutoff_hours: number
  transfer_cutoff_hours: number
  policy_text: string | null
  replay_available: boolean
  venue_id?: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  deleted_at: string | null
}

export type NewEventRow = Omit<EventRow, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>

async function rows(res: Response): Promise<EventRow[]> {
  if (!res.ok) {
    throw new Error(`attend_events query failed: ${res.status} ${await res.text()}`)
  }
  return (await res.json()) as EventRow[]
}

export async function insertEvent(row: NewEventRow): Promise<EventRow> {
  const created = await rows(await supaPost('attend_events', row, 'return=representation'))
  if (created.length === 0) throw new Error('attend_events insert returned no row')
  return created[0]
}

export async function getEventById(id: string): Promise<EventRow | null> {
  const r = await rows(
    await supaGet('attend_events', `id=eq.${encodeURIComponent(id)}&deleted_at=is.null&select=*`),
  )
  return r[0] ?? null
}

export async function getEventBySlug(slug: string): Promise<EventRow | null> {
  // encodeURIComponent: slug is the raw URL path segment (unauthenticated).
  // Unencoded, a crafted slug could inject PostgREST params to surface
  // DRAFT/soft-deleted events or widen the projection.
  const r = await rows(
    await supaGet('attend_events', `slug=eq.${encodeURIComponent(slug)}&deleted_at=is.null&select=*`),
  )
  return r[0] ?? null
}

export async function listEventsByCreator(creatorId: string): Promise<EventRow[]> {
  return rows(
    await supaGet(
      'attend_events',
      `creator_id=eq.${creatorId}&deleted_at=is.null&select=*&order=created_at.desc`,
    ),
  )
}

/** Events a buyer may browse: public, in a discoverable status, soonest first. */
export async function listDiscoverableEvents(): Promise<EventRow[]> {
  return rows(
    await supaGet(
      'attend_events',
      `status=in.(${DISCOVERABLE_STATUSES.join(',')})&visibility=eq.PUBLIC` +
        `&deleted_at=is.null&select=*&order=starts_at.asc`,
    ),
  )
}

/** All non-deleted events in a given status, oldest-updated first (a FIFO queue). */
export async function listEventsByStatus(status: EventStatus): Promise<EventRow[]> {
  return rows(
    await supaGet(
      'attend_events',
      `status=eq.${status}&deleted_at=is.null&select=*&order=updated_at.asc`,
    ),
  )
}

/** Slugs starting with `base` — used to pick a collision-free slug. */
export async function listSlugsLike(base: string): Promise<string[]> {
  const res = await supaGet('attend_events', `slug=like.${base}*&select=slug`)
  if (!res.ok) throw new Error(`attend_events slug query failed: ${res.status}`)
  return ((await res.json()) as { slug: string }[]).map((d) => d.slug)
}

export async function updateEvent(id: string, patch: Record<string, unknown>): Promise<void> {
  const res = await supaPatch('attend_events', `id=eq.${id}`, {
    ...patch,
    updated_at: new Date().toISOString(),
  })
  if (!res.ok) {
    throw new Error(`attend_events update failed: ${res.status} ${await res.text()}`)
  }
}
