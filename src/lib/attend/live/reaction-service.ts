// HYVE Attend live reactions — records the durable attend_reaction_events row,
// then broadcasts the reaction to the room channel (it drives the energy meter
// client-side via energyLevel).
import { insertReaction } from '@/lib/attend/live/reaction-repository'
import { broadcastToRoom } from '@/lib/attend/live/broadcast'
import { ValidationError } from '@/lib/attend/events/service'

export const REACTION_KINDS = ['CLAP', 'FIRE', 'HEART', 'WOW']

export async function postReaction(
  eventId: string,
  profileId: string,
  kind: string,
): Promise<void> {
  if (!REACTION_KINDS.includes(kind)) {
    throw new ValidationError('Unknown reaction')
  }
  await insertReaction({ event_id: eventId, profile_id: profileId, kind })
  await broadcastToRoom(eventId, 'reaction', { kind })
}
