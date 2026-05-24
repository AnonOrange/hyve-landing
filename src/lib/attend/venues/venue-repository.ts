// Raw-REST CRUD for venues + venue assets, via the shared Supabase helpers
// (service-key access, matching the rest of attend). No business logic here.
import { supaGet, supaPost } from '@/lib/supabase'
import type { VenueAssetInsert } from '@/lib/attend/venues/venue-record'

export interface VenueRow {
  id: string
  slug: string
  name: string
  managed_by: string | null
}

export async function getVenueBySlug(slug: string): Promise<VenueRow | null> {
  const res = await supaGet(
    'attend_venues',
    `slug=eq.${encodeURIComponent(slug)}&deleted_at=is.null&select=id,slug,name,managed_by`,
  )
  if (!res.ok) throw new Error(`getVenueBySlug failed: ${res.status} ${await res.text()}`)
  const rows = (await res.json()) as VenueRow[]
  return rows[0] ?? null
}

export async function insertVenue(input: {
  slug: string
  name: string
  city?: string
  country?: string
  managedBy?: string | null
  actor: string
}): Promise<VenueRow> {
  const res = await supaPost('attend_venues', {
    slug: input.slug,
    name: input.name,
    city: input.city ?? null,
    country: input.country ?? null,
    managed_by: input.managedBy ?? null,
    created_by: input.actor,
  })
  if (!res.ok) throw new Error(`insertVenue failed: ${res.status} ${await res.text()}`)
  return ((await res.json()) as VenueRow[])[0]
}

export async function insertVenueAsset(record: VenueAssetInsert): Promise<{ id: string }> {
  const res = await supaPost('attend_venue_assets', record)
  if (!res.ok) throw new Error(`insertVenueAsset failed: ${res.status} ${await res.text()}`)
  return ((await res.json()) as { id: string }[])[0]
}

export async function listVenueAssets(venueId: string): Promise<unknown[]> {
  const res = await supaGet(
    'attend_venue_assets',
    `venue_id=eq.${encodeURIComponent(venueId)}&deleted_at=is.null&order=created_at.desc`,
  )
  if (!res.ok) throw new Error(`listVenueAssets failed: ${res.status} ${await res.text()}`)
  return (await res.json()) as unknown[]
}

export async function listVenuesManagedBy(profileId: string): Promise<VenueRow[]> {
  const res = await supaGet(
    'attend_venues',
    `managed_by=eq.${encodeURIComponent(profileId)}&deleted_at=is.null&order=created_at.desc&select=id,slug,name,managed_by`,
  )
  if (!res.ok) throw new Error(`listVenuesManagedBy failed: ${res.status} ${await res.text()}`)
  return (await res.json()) as VenueRow[]
}

export async function listVenueSlugs(): Promise<string[]> {
  const res = await supaGet('attend_venues', `select=slug`)
  if (!res.ok) throw new Error(`listVenueSlugs failed: ${res.status} ${await res.text()}`)
  return ((await res.json()) as { slug: string }[]).map((r) => r.slug)
}

/** The latest displayable PANO_360 scan for a venue, or null. */
export async function getVenueActivePano(
  venueId: string,
): Promise<{ storagePath: string; manifest: Record<string, unknown> } | null> {
  const res = await supaGet(
    'attend_venue_assets',
    `venue_id=eq.${encodeURIComponent(venueId)}&tier=eq.PANO_360&status=in.(VALIDATED,ACTIVE)&deleted_at=is.null&order=created_at.desc&limit=1&select=storage_path,manifest`,
  )
  if (!res.ok) throw new Error(`getVenueActivePano failed: ${res.status} ${await res.text()}`)
  const rows = (await res.json()) as { storage_path: string; manifest: Record<string, unknown> }[]
  return rows[0] ? { storagePath: rows[0].storage_path, manifest: rows[0].manifest } : null
}
