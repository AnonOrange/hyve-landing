// Raw-REST data access for attend_streams. Query-only — no business logic.
import { supaGet, supaPost, supaPatch } from '@/lib/supabase'

export interface StreamRow {
  id: string
  event_id: string
  provider: string
  mux_stream_id: string | null
  mux_playback_id: string | null
  stream_key: string | null
  rtmp_url: string | null
  status: string
  test_passed_at: string | null
  recording_asset_id: string | null
  started_at: string | null
  ended_at: string | null
  created_at: string
  updated_at: string
}

export type NewStreamRow = Omit<StreamRow, 'id' | 'created_at' | 'updated_at'>

export async function getStreamByEventId(eventId: string): Promise<StreamRow | null> {
  const res = await supaGet('attend_streams', `event_id=eq.${eventId}&select=*`)
  if (!res.ok) throw new Error(`attend_streams query failed: ${res.status}`)
  const r = (await res.json()) as StreamRow[]
  return r[0] ?? null
}

export async function getStreamByMuxId(muxStreamId: string): Promise<StreamRow | null> {
  const res = await supaGet('attend_streams', `mux_stream_id=eq.${muxStreamId}&select=*`)
  if (!res.ok) throw new Error(`attend_streams query failed: ${res.status}`)
  const r = (await res.json()) as StreamRow[]
  return r[0] ?? null
}

export async function insertStream(row: NewStreamRow): Promise<StreamRow> {
  const res = await supaPost('attend_streams', row, 'return=representation')
  if (!res.ok) {
    throw new Error(`attend_streams insert failed: ${res.status} ${await res.text()}`)
  }
  const created = (await res.json()) as StreamRow[]
  if (created.length === 0) throw new Error('attend_streams insert returned no row')
  return created[0]
}

export async function updateStream(id: string, patch: Record<string, unknown>): Promise<void> {
  const res = await supaPatch('attend_streams', `id=eq.${id}`, {
    ...patch,
    updated_at: new Date().toISOString(),
  })
  if (!res.ok) throw new Error(`attend_streams update failed: ${res.status}`)
}
