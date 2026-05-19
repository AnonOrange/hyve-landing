// Raw-REST data access for attend_attendance_sessions / room-eligible tickets.
// Query-only — no business logic.
import { supaGet } from '@/lib/supabase'

export interface RoomTicket {
  id: string
  state: string
}

// The owner's tickets for an event that may enter the room (owned-idle or
// already inside). EXPIRED/REFUNDED/etc. tickets are excluded.
export async function listRoomTicketsForOwner(
  eventId: string,
  ownerId: string,
): Promise<RoomTicket[]> {
  const res = await supaGet(
    'attend_tickets',
    `event_id=eq.${eventId}&owner_id=eq.${ownerId}` +
      `&state=in.(ASSIGNED_TO_BUYER,TRANSFER_ACCEPTED,CHECKED_IN,IN_ROOM)&select=id,state`,
  )
  if (!res.ok) throw new Error(`attend_tickets query failed: ${res.status}`)
  return (await res.json()) as RoomTicket[]
}
