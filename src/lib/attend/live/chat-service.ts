// HYVE Attend live chat — writes the durable attend_chat_messages row, then
// broadcasts the message to the room channel for live delivery.
import {
  type ChatMessageRow,
  insertChatMessage,
  listRecentChatMessages,
} from '@/lib/attend/live/chat-repository'
import { broadcastToRoom } from '@/lib/attend/live/broadcast'
import { ValidationError } from '@/lib/attend/events/service'

const MAX_BODY = 500

export async function postChatMessage(
  eventId: string,
  profileId: string,
  displayName: string,
  body: string,
): Promise<void> {
  const trimmed = body.trim()
  if (!trimmed) throw new ValidationError('Message cannot be empty')
  if (trimmed.length > MAX_BODY) {
    throw new ValidationError(`Message must be ${MAX_BODY} characters or fewer`)
  }

  const row = await insertChatMessage({
    event_id: eventId,
    profile_id: profileId,
    body: trimmed,
  })
  await broadcastToRoom(eventId, 'chat', {
    id: row.id,
    displayName,
    body: trimmed,
    createdAt: row.created_at,
  })
}

export async function getRecentChat(eventId: string): Promise<ChatMessageRow[]> {
  return listRecentChatMessages(eventId)
}
