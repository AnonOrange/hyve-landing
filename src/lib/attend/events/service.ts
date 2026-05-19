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
import { assertTransition, draftTargetStatus, EventStatus } from '@/lib/attend/events/lifecycle'
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
 * Internal / cancellation use only — the public PATCH route exposes just the
 * guarded `advanceSetup` and a `cancel` action, not free-form transitions.
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

/**
 * Advance an event one guarded step along the setup chain:
 *   PROMOTION_FEE_PAID    -> PAYOUT_SETUP_REQUIRED   (automatic)
 *   PAYOUT_SETUP_REQUIRED -> STREAM_SETUP_REQUIRED   (requires Connect payouts)
 * `payoutsAreEnabled` is supplied by the caller — the route composes events +
 * payments, so this module stays free of payment-module imports.
 */
export async function advanceSetup(
  id: string,
  creatorId: string,
  payoutsAreEnabled: boolean,
): Promise<EventStatus> {
  const event = await loadOwned(id, creatorId)
  if (event.status === 'PROMOTION_FEE_PAID') {
    assertTransition(event.status, 'PAYOUT_SETUP_REQUIRED')
    await updateEvent(id, { status: 'PAYOUT_SETUP_REQUIRED', updated_by: creatorId })
    return 'PAYOUT_SETUP_REQUIRED'
  }
  if (event.status === 'PAYOUT_SETUP_REQUIRED') {
    if (!payoutsAreEnabled) {
      throw new ValidationError('Complete Stripe Connect onboarding before continuing')
    }
    assertTransition(event.status, 'STREAM_SETUP_REQUIRED')
    await updateEvent(id, { status: 'STREAM_SETUP_REQUIRED', updated_by: creatorId })
    return 'STREAM_SETUP_REQUIRED'
  }
  throw new ValidationError('There is nothing to advance for this event')
}

/**
 * Move a finished DRAFT into the setup chain: a paid show to
 * REGISTRATION_PENDING, a FREE_EVENT straight to STREAM_SETUP_REQUIRED.
 * `ticketTypeCount` is supplied by the caller — the route composes events +
 * ticketing, so this module stays free of ticketing-module imports.
 */
export async function submitDraft(
  id: string,
  creatorId: string,
  ticketTypeCount: number,
): Promise<EventStatus> {
  const event = await loadOwned(id, creatorId)
  if (event.status !== 'DRAFT') {
    throw new ValidationError('Only a draft event can be moved into setup')
  }
  if (!event.starts_at || !event.ends_at) {
    throw new ValidationError('Set the event start and end times before continuing')
  }
  const target = draftTargetStatus(event.show_type)
  if (target === 'REGISTRATION_PENDING' && ticketTypeCount < 1) {
    throw new ValidationError('Add at least one ticket type before continuing')
  }
  assertTransition(event.status, target)
  await updateEvent(id, { status: target, updated_by: creatorId })
  return target
}

/**
 * Submit a STREAM_SETUP_REQUIRED event for review. `streamTestPassed` is
 * supplied by the route (attend_streams.test_passed_at is non-null) — the
 * route composes events + streaming, keeping this module streaming-free.
 */
export async function submitForReview(
  id: string,
  creatorId: string,
  streamTestPassed: boolean,
): Promise<void> {
  const event = await loadOwned(id, creatorId)
  if (event.status !== 'STREAM_SETUP_REQUIRED') {
    throw new ValidationError('This event is not ready to submit for review')
  }
  if (!streamTestPassed) {
    throw new ValidationError('Run a successful stream test before submitting for review')
  }
  assertTransition(event.status, 'SUBMITTED_FOR_REVIEW')
  await updateEvent(id, { status: 'SUBMITTED_FOR_REVIEW', updated_by: creatorId })
}
