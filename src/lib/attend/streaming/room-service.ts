// HYVE Attend event room — composes room access (gate), the room view
// (event + signed playback), and check-in. Server-side only.
import { type EventRow, getEventBySlug } from '@/lib/attend/events/repository'
import { ValidationError } from '@/lib/attend/events/service'
import { getEventStream } from '@/lib/attend/streaming/streaming-service'
import { streamProvider } from '@/lib/attend/streaming/provider'
import { listRoomTicketsForOwner } from '@/lib/attend/streaming/attendance-repository'
import { getVenueActiveScan } from '@/lib/attend/venues/venue-repository'
import { publicVenueUrl } from '@/lib/attend/venues/venue-storage'
import { venueScanFromManifest, type VenueScan } from '@/lib/attend/venues/viewer-math'
import { supaPost } from '@/lib/supabase'

const LIVE_ROOM_STATUSES = ['SOUNDCHECK', 'DOORS_OPEN', 'LIVE']

export interface RoomAccess {
  event: EventRow
  ticketId: string
}

/** Whether a profile may enter an event's room: a live-ish event for which
 *  they hold a room-eligible ticket. Returns the event + that ticket, or null. */
export async function getRoomAccess(
  slug: string,
  profileId: string,
): Promise<RoomAccess | null> {
  const event = await getEventBySlug(slug)
  if (!event || !LIVE_ROOM_STATUSES.includes(event.status)) return null
  const tickets = await listRoomTicketsForOwner(event.id, profileId)
  if (tickets.length === 0) return null
  return { event, ticketId: tickets[0].id }
}

export interface RoomView {
  event: EventRow
  ticketId: string
  playbackId: string | null
  playbackToken: string | null
  venueScan: VenueScan | null
}

/** The room page's data: access, a signed Mux playback token, and (if the
 *  event is linked to a venue) that venue's scan for the 3D view. */
export async function getRoomView(slug: string, profileId: string): Promise<RoomView | null> {
  const access = await getRoomAccess(slug, profileId)
  if (!access) return null

  const stream = await getEventStream(access.event.id)
  let playbackId: string | null = null
  let playbackToken: string | null = null
  if (stream?.mux_playback_id) {
    playbackId = stream.mux_playback_id
    playbackToken = await streamProvider().signPlaybackToken(stream.mux_playback_id)
  }

  let venueScan: VenueScan | null = null
  if (access.event.venue_id) {
    const asset = await getVenueActiveScan(access.event.venue_id)
    if (asset) venueScan = venueScanFromManifest(asset.manifest, publicVenueUrl(asset.storagePath))
  }

  return { event: access.event, ticketId: access.ticketId, playbackId, playbackToken, venueScan }
}

export interface CheckInContext {
  device?: string | null
  browser?: string | null
  ipHash?: string | null
}

/** Run the atomic attend_check_in RPC; an { ok: false } result is a ValidationError. */
export async function checkInToRoom(
  ticketId: string,
  profileId: string,
  ctx: CheckInContext = {},
): Promise<void> {
  const res = await supaPost('rpc/attend_check_in', {
    p_args: {
      ticket_id: ticketId,
      profile_id: profileId,
      device: ctx.device ?? null,
      browser: ctx.browser ?? null,
      ip_hash: ctx.ipHash ?? null,
    },
  })
  if (!res.ok) {
    throw new Error(`attend_check_in RPC failed: ${res.status} ${await res.text()}`)
  }
  const result = (await res.json()) as { ok?: boolean; error?: string }
  if (result.ok === false) {
    throw new ValidationError(result.error ?? 'Check-in could not be completed')
  }
}
