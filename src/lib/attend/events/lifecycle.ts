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
