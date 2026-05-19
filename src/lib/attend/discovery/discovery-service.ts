// HYVE Attend discovery — buyer-facing read composition for the discovery
// page and the event page. Server-side only (service-key reads). No auth,
// no writes: Phase 3a is the read-only front of the buyer flow.
import {
  type EventRow,
  listDiscoverableEvents,
  getEventBySlug,
} from '@/lib/attend/events/repository'
import { eventTiming, isPubliclyViewable } from '@/lib/attend/events/lifecycle'
import { getFeaturedEvents, type FeaturedEvent } from '@/lib/attend/promotion/promotion-service'
import {
  type TicketTypeRow,
  listTicketTypesByEvent,
} from '@/lib/attend/ticketing/ticket-type-repository'
import {
  getArtistProfileByProfileId,
  getProfileById,
} from '@/lib/attend/identity/profile-repository'

export interface DiscoveryFeed {
  featured: FeaturedEvent[]
  live: EventRow[]
  upcoming: EventRow[]
}

/** The discovery page: a featured row, plus events happening now and upcoming. */
export async function getDiscoveryFeed(): Promise<DiscoveryFeed> {
  const [events, featured] = await Promise.all([listDiscoverableEvents(), getFeaturedEvents()])
  const live: EventRow[] = []
  const upcoming: EventRow[] = []
  for (const ev of events) {
    if (eventTiming(ev.status) === 'LIVE') live.push(ev)
    else upcoming.push(ev)
  }
  return { featured, live, upcoming }
}

export interface EventPageArtist {
  name: string
  bio: string | null
  avatarUrl: string | null
}

export interface EventPageData {
  event: EventRow
  ticketTypes: TicketTypeRow[]
  artist: EventPageArtist
}

/**
 * The full event page for a slug, or null if the event is missing, soft-
 * deleted, not PUBLIC, or not in a buyer-discoverable status. A PRIVATE event
 * is hidden here even when published; a DRAFT/setup event is never viewable.
 */
export async function getEventPage(slug: string): Promise<EventPageData | null> {
  const event = await getEventBySlug(slug)
  if (!event || !isPubliclyViewable(event.status, event.visibility)) return null

  // Show ACTIVE/PAUSED/SOLD_OUT tiers; only a HIDDEN tier is withheld.
  const ticketTypes = (await listTicketTypesByEvent(event.id)).filter(
    (t) => t.status !== 'HIDDEN',
  )

  return { event, ticketTypes, artist: await resolveArtist(event.creator_id) }
}

// Prefer the artist profile (stage name, bio, avatar); fall back to the plain
// profile's display name; finally a generic label.
async function resolveArtist(creatorId: string): Promise<EventPageArtist> {
  const artist = await getArtistProfileByProfileId(creatorId)
  if (artist) {
    return { name: artist.stage_name, bio: artist.bio, avatarUrl: artist.avatar_url }
  }
  const profile = await getProfileById(creatorId)
  if (profile) {
    return { name: profile.display_name, bio: null, avatarUrl: profile.avatar_url }
  }
  return { name: 'Artist', bio: null, avatarUrl: null }
}
