// Pure: map a manifest validation result to the venue_asset row to insert.
// The only branching logic in this sub-plan, hence the only unit-tested file.
import type {
  VenueManifest,
  VenueTier,
  ManifestValidation,
} from '@/lib/attend/venues/manifest-types'

export interface VenueAssetInsert {
  venue_id: string
  tier: VenueTier
  status: 'VALIDATED' | 'REJECTED'
  manifest: VenueManifest
  storage_path: string
  validation_errors: string[] | null
  validation_warnings: string[] | null
  created_by: string
}

export function buildVenueAssetRecord(input: {
  venueId: string
  tier: VenueTier
  manifest: VenueManifest
  storagePath: string
  validation: ManifestValidation
  actor: string
}): VenueAssetInsert {
  const { validation } = input
  return {
    venue_id: input.venueId,
    tier: input.tier,
    status: validation.ok ? 'VALIDATED' : 'REJECTED',
    manifest: input.manifest,
    storage_path: input.storagePath,
    validation_errors: validation.errors.length ? validation.errors : null,
    validation_warnings: validation.warnings.length ? validation.warnings : null,
    created_by: input.actor,
  }
}
