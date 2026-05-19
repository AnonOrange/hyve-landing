// Raw-REST data access for attend_chat_messages. Query-only — no business logic.
import { supaGet, supaPost } from '@/lib/supabase'

export interface ChatMessageRow {
  id: string
  event_id: string
  profile_id: string
  body: string
  moderation_state: string
  created_at: string
  // Embedded on a list query; absent on an insert's representation.
  attend_profiles?: { display_name: string } | null
}

export interface NewChatMessage {
  event_id: string
  profile_id: string
  body: string
}

export async function insertChatMessage(msg: NewChatMessage): Promise<ChatMessageRow> {
  const res = await supaPost('attend_chat_messages', msg, 'return=representation')
  if (!res.ok) {
    throw new Error(`attend_chat_messages insert failed: ${res.status} ${await res.text()}`)
  }
  const created = (await res.json()) as ChatMessageRow[]
  if (created.length === 0) throw new Error('attend_chat_messages insert returned no row')
  return created[0]
}

/** Recent VISIBLE messages for an event, oldest-first, sender name embedded. */
export async function listRecentChatMessages(
  eventId: string,
  limit = 50,
): Promise<ChatMessageRow[]> {
  const res = await supaGet(
    'attend_chat_messages',
    `event_id=eq.${eventId}&moderation_state=eq.VISIBLE` +
      `&select=*,attend_profiles(display_name)&order=created_at.desc&limit=${limit}`,
  )
  if (!res.ok) throw new Error(`attend_chat_messages query failed: ${res.status}`)
  const rows = (await res.json()) as ChatMessageRow[]
  return rows.reverse()
}
