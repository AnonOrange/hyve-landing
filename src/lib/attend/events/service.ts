// HYVE Attend events service — business logic for the creator event flow.
import {
  EventRow,
  NewEventRow,
  insertEvent,
  getEventById,
  listEventsByCreator,
  listSlugsLike,
  updateEvent,
} from '@/lib/attend/events/repository'
import { assertTransition, EventStatus } from '@/lib/attend/events/lifecycle'
import { slugifyTitle, uniqueSlug } from '@/lib/attend/events/slug'

/** The caller is not allowed to act on this resource. */
export class ForbiddenError extends Error {}
/** The request was malformed or violates a rule. */
export class ValidationError extends Error {}
/** The resource does not exist. */
export class NotFoundError extends Error {}

// Show types a creator can actually pick in the MVP (spec §2.3).
const MVP_SHOW_TYPES = ['HUMAN_LIVE_BROADCAST', 'FREE_EVENT', 'PRIVATE_EVENT'] as const
export type MvpShowType = (typeof MVP_SHOW_TYPES)[number]

export interface EventInput {
  title: string
  showType: MvpShowType
  startsAt: string
  endsAt: string
  timezone: string
  description?: string
}

// Detail fields a creator may edit while an event is still a DRAFT.
const EDITABLE_FIELDS = [
  'title', 'description', 'starts_at', 'ends_at', 'timezone',
  'visibility', 'policy_text', 'refund_cutoff_hours', 'transfer_cutoff_hours',
] as const

export async function createDraftEvent(creatorId: string, input: EventInput): Promise<EventRow> {
  if (!input.title?.trim()) throw new ValidationError('Title is required')
  if (!input.startsAt || !input.endsAt) throw new ValidationError('Start and end times are required')
  if (!input.timezone) throw new ValidationError('Timezone is required')
  if (!MVP_SHOW_TYPES.includes(input.showType)) {
    throw new ValidationError(`Show type "${input.showType}" is not available in the MVP`)
  }

  // Check-then-insert race: two creators with the same title can compute the
  // same slug. The DB's unique(slug) constraint backstops it (one INSERT
  // fails); harden with retry-on-conflict or the §5.3 atomic RPC in a later phase.
  const base = slugifyTitle(input.title)
  const slug = uniqueSlug(base, await listSlugsLike(base))

  const row: NewEventRow = {
    slug,
    creator_id: creatorId,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    show_type: input.showType,
    status: 'DRAFT',
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    timezone: input.timezone,
    visibility: input.showType === 'PRIVATE_EVENT' ? 'PRIVATE' : 'PUBLIC',
    hero_media_id: null,
    refund_cutoff_hours: 24,
    transfer_cutoff_hours: 2,
    policy_text: null,
    replay_available: false,
    created_by: creatorId,
    updated_by: creatorId,
  }
  return insertEvent(row)
}

async function loadOwned(id: string, creatorId: string): Promise<EventRow> {
  const event = await getEventById(id)
  if (!event) throw new NotFoundError('Event not found')
  if (event.creator_id !== creatorId) throw new ForbiddenError('This is not your event')
  return event
}

export async function getCreatorEvent(id: string, creatorId: string): Promise<EventRow> {
  return loadOwned(id, creatorId)
}

export async function listMyEvents(creatorId: string): Promise<EventRow[]> {
  return listEventsByCreator(creatorId)
}

/** Edit detail fields — only while the event is a DRAFT. Never changes status. */
export async function updateEventDetails(
  id: string,
  creatorId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const event = await loadOwned(id, creatorId)
  if (event.status !== 'DRAFT') {
    throw new ValidationError('Event details can only be edited while the event is a draft')
  }
  const clean: Record<string, unknown> = { updated_by: creatorId }
  for (const field of EDITABLE_FIELDS) {
    if (field in patch) clean[field] = patch[field]
  }
  await updateEvent(id, clean)
}

/**
 * Move the event to a new status, enforcing the §6.9 transition topology.
 * NOTE: only topology is checked here. Guard *conditions* ($50 paid, stream
 * tested) and transition *authority* (admin-only approve/reject) land in
 * Phase 2b — until then this PATCH surface is creator-reachable.
 */
export async function changeEventStatus(
  id: string,
  creatorId: string,
  to: EventStatus,
): Promise<void> {
  const event = await loadOwned(id, creatorId)
  try {
    assertTransition(event.status, to)
  } catch (err) {
    throw new ValidationError((err as Error).message)
  }
  await updateEvent(id, { status: to, updated_by: creatorId })
}
