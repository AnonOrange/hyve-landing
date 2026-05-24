// Venue scan persistence: validate a manifest, then store the resulting
// asset row. Orchestration over the pure validator + record builder + repo.
import type { VenueManifest, VenueTier } from '@/lib/attend/venues/manifest-types'
import { validateManifest } from '@/lib/attend/venues/manifest-validator'
import { buildVenueAssetRecord } from '@/lib/attend/venues/venue-record'
import { insertVenueAsset } from '@/lib/attend/venues/venue-repository'

/**
 * Validate a manifest and persist the resulting asset row. Returns the new id,
 * the stored status, and the validation result so the caller (the upload API)
 * can surface errors/warnings. A REJECTED asset is still stored — it's the
 * audit trail of what a venue submitted and why it failed.
 */
export async function persistVenueAsset(input: {
  venueId: string
  tier: VenueTier
  manifest: VenueManifest
  storagePath: string
  actor: string
}) {
  const validation = validateManifest(input.manifest)
  const record = buildVenueAssetRecord({ ...input, validation })
  const { id } = await insertVenueAsset(record)
  return { id, status: record.status, validation }
}
