// Raw-REST data access for attend_tickets. Query-only — no business logic.
import { supaGet } from '@/lib/supabase'

export interface OwnedTicket {
  id: string
  state: string
  access_token: string
  created_at: string
  attend_events: {
    id: string
    title: string
    slug: string
    starts_at: string | null
    status: string
  }
  attend_ticket_types: { name: string; kind: string }
  // A ticket has at most one PENDING transfer; past REVOKED/EXPIRED/ACCEPTED
  // rows may also appear — the wallet picks the PENDING one.
  attend_ticket_transfers: {
    id: string
    method: string
    friend_code: string | null
    to_email: string | null
    status: string
  }[]
}

/**
 * A buyer's owned tickets with their event + tier embedded. PostgREST joins on
 * the attend_tickets FKs (event_id -> attend_events, ticket_type_id ->
 * attend_ticket_types); both are single-FK, so the embeds are to-one objects.
 */
export async function listOwnedTicketsWithContext(ownerId: string): Promise<OwnedTicket[]> {
  const res = await supaGet(
    'attend_tickets',
    `owner_id=eq.${ownerId}` +
      `&select=id,state,access_token,created_at,` +
      `attend_events(id,title,slug,starts_at,status),` +
      `attend_ticket_types(name,kind),` +
      `attend_ticket_transfers(id,method,friend_code,to_email,status)` +
      `&order=created_at.desc`,
  )
  if (!res.ok) throw new Error(`attend_tickets query failed: ${res.status}`)
  return (await res.json()) as OwnedTicket[]
}
