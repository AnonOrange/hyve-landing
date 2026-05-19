// Raw-REST data access for attend_ticket_types. Query-only — no business logic.
import { supaGet, supaPost, supaPatch, supaDelete } from '@/lib/supabase'

export interface TicketTypeRow {
  id: string
  event_id: string
  name: string
  kind: string
  price_cents: number
  currency: string
  quantity_total: number
  quantity_sold: number
  max_per_order: number
  sales_start_at: string | null
  sales_end_at: string | null
  status: string
  created_at: string
  updated_at: string
}

export type NewTicketTypeRow = Omit<TicketTypeRow, 'id' | 'created_at' | 'updated_at'>

async function rows(res: Response): Promise<TicketTypeRow[]> {
  if (!res.ok) {
    throw new Error(`attend_ticket_types query failed: ${res.status} ${await res.text()}`)
  }
  return (await res.json()) as TicketTypeRow[]
}

export async function insertTicketType(row: NewTicketTypeRow): Promise<TicketTypeRow> {
  const created = await rows(await supaPost('attend_ticket_types', row, 'return=representation'))
  if (created.length === 0) throw new Error('attend_ticket_types insert returned no row')
  return created[0]
}

export async function listTicketTypesByEvent(eventId: string): Promise<TicketTypeRow[]> {
  return rows(
    await supaGet('attend_ticket_types', `event_id=eq.${eventId}&select=*&order=created_at.asc`),
  )
}

export async function getTicketTypeById(id: string): Promise<TicketTypeRow | null> {
  const r = await rows(await supaGet('attend_ticket_types', `id=eq.${id}&select=*`))
  return r[0] ?? null
}

export async function updateTicketType(id: string, patch: Record<string, unknown>): Promise<void> {
  const res = await supaPatch('attend_ticket_types', `id=eq.${id}`, {
    ...patch,
    updated_at: new Date().toISOString(),
  })
  if (!res.ok) throw new Error(`attend_ticket_types update failed: ${res.status}`)
}

export async function deleteTicketType(id: string): Promise<void> {
  const res = await supaDelete('attend_ticket_types', `id=eq.${id}`)
  if (!res.ok) throw new Error(`attend_ticket_types delete failed: ${res.status}`)
}
