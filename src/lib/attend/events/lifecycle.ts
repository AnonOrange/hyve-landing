// HYVE Attend event lifecycle — the authoritative transition topology
// (spec §6.9). Pure: this module knows which from->to pairs are legal.
// Guard conditions (e.g. "$50 paid") are checked by the events service
// before it calls a transition; this module owns the topology only.

export type EventStatus =
  | 'DRAFT' | 'REGISTRATION_PENDING' | 'PROMOTION_FEE_PAID' | 'PAYOUT_SETUP_REQUIRED'
  | 'STREAM_SETUP_REQUIRED' | 'SUBMITTED_FOR_REVIEW' | 'PUBLISHED' | 'ON_SALE'
  | 'SALES_PAUSED' | 'SOUNDCHECK' | 'DOORS_OPEN' | 'LIVE' | 'ENDED'
  | 'SETTLEMENT_HOLD' | 'SETTLED' | 'REFUNDING' | 'CANCELLED' | 'ARCHIVED'

const CANCELLABLE: EventStatus[] = [
  'DRAFT', 'REGISTRATION_PENDING', 'PROMOTION_FEE_PAID', 'PAYOUT_SETUP_REQUIRED',
  'STREAM_SETUP_REQUIRED', 'SUBMITTED_FOR_REVIEW', 'PUBLISHED', 'ON_SALE',
  'SALES_PAUSED', 'SOUNDCHECK', 'DOORS_OPEN', 'LIVE',
]

// Allowed next-states per spec §6.9. CANCELLED is appended to every
// cancellable state's list below.
const BASE_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  DRAFT: ['REGISTRATION_PENDING', 'STREAM_SETUP_REQUIRED'],
  REGISTRATION_PENDING: ['PROMOTION_FEE_PAID'],
  PROMOTION_FEE_PAID: ['PAYOUT_SETUP_REQUIRED'],
  PAYOUT_SETUP_REQUIRED: ['STREAM_SETUP_REQUIRED'],
  STREAM_SETUP_REQUIRED: ['SUBMITTED_FOR_REVIEW'],
  SUBMITTED_FOR_REVIEW: ['PUBLISHED', 'DRAFT'],
  PUBLISHED: ['ON_SALE'],
  ON_SALE: ['SALES_PAUSED', 'SOUNDCHECK'],
  SALES_PAUSED: ['ON_SALE', 'SOUNDCHECK'],
  SOUNDCHECK: ['DOORS_OPEN'],
  DOORS_OPEN: ['LIVE'],
  LIVE: ['ENDED'],
  ENDED: ['SETTLEMENT_HOLD'],
  SETTLEMENT_HOLD: ['SETTLED'],
  SETTLED: ['ARCHIVED'],
  REFUNDING: ['SETTLED'],
  CANCELLED: ['REFUNDING', 'ARCHIVED'],
  ARCHIVED: [],
}

const TRANSITIONS: Record<EventStatus, EventStatus[]> = Object.fromEntries(
  Object.entries(BASE_TRANSITIONS).map(([from, tos]) => [
    from,
    CANCELLABLE.includes(from as EventStatus) ? [...tos, 'CANCELLED'] : tos,
  ]),
) as Record<EventStatus, EventStatus[]>

export const ALL_STATUSES = Object.keys(BASE_TRANSITIONS) as EventStatus[]

export function canTransition(from: EventStatus, to: EventStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

export function assertTransition(from: EventStatus, to: EventStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal event transition: ${from} -> ${to}`)
  }
}

// DRAFT has two legal successors (see BASE_TRANSITIONS.DRAFT): which one an
// event takes depends on its show type. A FREE_EVENT skips the registration
// fee + payout gates (spec §6.9); every other MVP show type pays first.
export function draftTargetStatus(showType: string): EventStatus {
  return showType === 'FREE_EVENT' ? 'STREAM_SETUP_REQUIRED' : 'REGISTRATION_PENDING'
}

// Statuses at which a buyer may discover and view an event (spec §7). The
// single source of truth for both the discovery query and the event-page gate.
export const DISCOVERABLE_STATUSES: EventStatus[] = [
  'PUBLISHED', 'ON_SALE', 'SALES_PAUSED', 'SOUNDCHECK', 'DOORS_OPEN', 'LIVE',
]

export function isDiscoverable(status: EventStatus): boolean {
  return DISCOVERABLE_STATUSES.includes(status)
}

// A buyer-facing event page is shown only for a PUBLIC event in a discoverable
// status. A PRIVATE event stays hidden here even once published — it is reached
// by direct invite (a later phase), never by guessing its slug.
export function isPubliclyViewable(status: EventStatus, visibility: string): boolean {
  return visibility === 'PUBLIC' && isDiscoverable(status)
}

export type EventTiming = 'LIVE' | 'UPCOMING'

// A discoverable event is either happening now or still upcoming — the two
// sections the discovery page renders.
const LIVE_STATUSES: EventStatus[] = ['SOUNDCHECK', 'DOORS_OPEN', 'LIVE']

export function eventTiming(status: EventStatus): EventTiming {
  return LIVE_STATUSES.includes(status) ? 'LIVE' : 'UPCOMING'
}
