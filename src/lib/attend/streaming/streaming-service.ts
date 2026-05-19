// HYVE Attend streaming service — provisions an event's Mux Live stream and
// keeps attend_streams in sync with the provider's webhook events.
import {
  type StreamRow,
  type NewStreamRow,
  getStreamByEventId,
  getStreamByMuxId,
  insertStream,
  updateStream,
} from '@/lib/attend/streaming/stream-repository'
import { streamProvider } from '@/lib/attend/streaming/provider'
import { getEventById } from '@/lib/attend/events/repository'
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/attend/events/service'

export type { StreamRow }

export async function getEventStream(eventId: string): Promise<StreamRow | null> {
  return getStreamByEventId(eventId)
}

/** Provision the Mux Live stream for an event awaiting stream setup. */
export async function createEventStream(
  eventId: string,
  creatorId: string,
): Promise<StreamRow> {
  const event = await getEventById(eventId)
  if (!event) throw new NotFoundError('Event not found')
  if (event.creator_id !== creatorId) throw new ForbiddenError('This is not your event')
  if (event.status !== 'STREAM_SETUP_REQUIRED') {
    throw new ValidationError('This event is not awaiting stream setup')
  }

  // Idempotent: a second call returns the existing row. attend_streams.event_id
  // is unique, so a rare concurrent double-call fails the loser's insert.
  const existing = await getStreamByEventId(eventId)
  if (existing) return existing

  const live = await streamProvider().createLiveStream()
  const row: NewStreamRow = {
    event_id: eventId,
    provider: 'mux',
    mux_stream_id: live.streamId,
    mux_playback_id: live.playbackId,
    stream_key: live.streamKey,
    rtmp_url: live.rtmpUrl,
    status: 'IDLE',
    test_passed_at: null,
    recording_asset_id: null,
    started_at: null,
    ended_at: null,
  }
  return insertStream(row)
}

/**
 * Apply a Mux live-stream webhook event. Keeps attend_streams in sync; the
 * first time a stream goes active is the creator's stream test passing.
 */
export async function applyMuxStreamEvent(
  muxStreamId: string,
  eventType: string,
): Promise<void> {
  const stream = await getStreamByMuxId(muxStreamId)
  if (!stream) return // a stream we do not track

  const patch: Record<string, unknown> = {}
  if (eventType === 'video.live_stream.active') {
    patch.status = 'ACTIVE'
    if (!stream.started_at) patch.started_at = new Date().toISOString()
    if (!stream.test_passed_at) patch.test_passed_at = new Date().toISOString()
  } else if (eventType === 'video.live_stream.idle') {
    patch.status = 'IDLE'
  } else if (eventType === 'video.live_stream.disconnected') {
    patch.status = 'DISCONNECTED'
  } else {
    return // not an event we act on in Phase 5a
  }
  await updateStream(stream.id, patch)
}
