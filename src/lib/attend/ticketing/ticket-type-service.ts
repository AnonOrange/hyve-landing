// HYVE Attend ticket-type service — creator-managed ticket tiers for an
// event. Ticket types can only be changed while the event is a DRAFT.
import {
  TicketTypeRow,
  NewTicketTypeRow,
  insertTicketType,
  listTicketTypesByEvent,
  getTicketTypeById,
  updateTicketType,
  deleteTicketType,
} from '@/lib/attend/ticketing/ticket-type-repository'
import { getEventById } from '@/lib/attend/events/repository'
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/attend/events/service'

const KINDS = [
  'GENERAL_ADMISSION', 'VIP', 'BACKSTAGE_QA', 'REPLAY_ACCESS',
  'GROUP_PACK', 'EARLY_BIRD', 'PROMO_CODE', 'COMPLIMENTARY',
]

export interface TicketTypeInput {
  name: string
  kind?: string
  priceCents: number
  quantityTotal: number
  maxPerOrder?: number
}

function validate(input: TicketTypeInput): void {
  if (!input.name?.trim()) throw new ValidationError('Ticket type name is required')
  if (!Number.isInteger(input.priceCents) || input.priceCents < 0) {
    throw new ValidationError('priceCents must be a non-negative integer')
  }
  if (!Number.isInteger(input.quantityTotal) || input.quantityTotal < 0) {
    throw new ValidationError('quantityTotal must be a non-negative integer')
  }
  if (input.maxPerOrder !== undefined && (!Number.isInteger(input.maxPerOrder) || input.maxPerOrder < 1)) {
    throw new ValidationError('maxPerOrder must be a positive integer')
  }
  if (input.kind !== undefined && !KINDS.includes(input.kind)) {
    throw new ValidationError(`Unknown ticket type kind: ${input.kind}`)
  }
}

// Loads the event behind a ticket-type action, asserting ownership and that
// the event is still a DRAFT (ticket types are locked once it leaves DRAFT).
async function ownedDraftEvent(eventId: string, creatorId: string): Promise<void> {
  const event = await getEventById(eventId)
  if (!event) throw new NotFoundError('Event not found')
  if (event.creator_id !== creatorId) throw new ForbiddenError('This is not your event')
  if (event.status !== 'DRAFT') {
    throw new ValidationError('Ticket types can only be changed while the event is a draft')
  }
}

export async function listEventTicketTypes(
  eventId: string,
  creatorId: string,
): Promise<TicketTypeRow[]> {
  const event = await getEventById(eventId)
  if (!event) throw new NotFoundError('Event not found')
  if (event.creator_id !== creatorId) throw new ForbiddenError('This is not your event')
  return listTicketTypesByEvent(eventId)
}

export async function addTicketType(
  eventId: string,
  creatorId: string,
  input: TicketTypeInput,
): Promise<TicketTypeRow> {
  await ownedDraftEvent(eventId, creatorId)
  validate(input)
  const row: NewTicketTypeRow = {
    event_id: eventId,
    name: input.name.trim(),
    kind: input.kind ?? 'GENERAL_ADMISSION',
    price_cents: input.priceCents,
    currency: 'usd',
    quantity_total: input.quantityTotal,
    quantity_sold: 0,
    max_per_order: input.maxPerOrder ?? 10,
    sales_start_at: null,
    sales_end_at: null,
    status: 'ACTIVE',
  }
  return insertTicketType(row)
}

async function ownedTicketType(id: string, creatorId: string): Promise<void> {
  const tt = await getTicketTypeById(id)
  if (!tt) throw new NotFoundError('Ticket type not found')
  await ownedDraftEvent(tt.event_id, creatorId)
}

export async function editTicketType(
  id: string,
  creatorId: string,
  input: TicketTypeInput,
): Promise<void> {
  await ownedTicketType(id, creatorId)
  validate(input)
  // Only patch optional fields when supplied, so an edit that omits `kind`
  // or `maxPerOrder` does not clobber a previously-set value.
  const patch: Record<string, unknown> = {
    name: input.name.trim(),
    price_cents: input.priceCents,
    quantity_total: input.quantityTotal,
  }
  if (input.kind !== undefined) patch.kind = input.kind
  if (input.maxPerOrder !== undefined) patch.max_per_order = input.maxPerOrder
  await updateTicketType(id, patch)
}

export async function removeTicketType(id: string, creatorId: string): Promise<void> {
  await ownedTicketType(id, creatorId)
  await deleteTicketType(id)
}
