// Pure validator for venue scan manifests. Returns enumerated errors +
// warnings; does NOT throw (callers map ok:false to a 422). See spec §6/§7.
import type {
  VenueManifest,
  ManifestValidation,
  ManifestErrorCode,
  ManifestWarningCode,
} from '@/lib/attend/venues/manifest-types'

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

export function validateManifest(input: unknown): ManifestValidation {
  const errors: ManifestErrorCode[] = []
  const warnings: ManifestWarningCode[] = []
  if (!isObject(input)) return { ok: false, errors: ['NOT_AN_OBJECT'], warnings: [] }

  const m = input as Partial<VenueManifest>

  if (!m.manifestVersion) errors.push('MISSING_MANIFEST_VERSION')
  if (m.tier !== 'PANO_360' && m.tier !== 'NAV_MESH') errors.push('UNSUPPORTED_TIER')

  if (!m.world || m.world.unit !== 'meter') errors.push('WRONG_UNIT')
  if (!m.world || m.world.upAxis !== 'Y') errors.push('WRONG_UP_AXIS')

  if (!m.asset || !Array.isArray(m.asset.files) || m.asset.files.length === 0) {
    errors.push('ASSET_MISSING_FILES')
  }

  const a = m.anchors
  if (!a || !a.stageScreen) errors.push('MISSING_STAGE_SCREEN')
  if (!a || !a.spawn) errors.push('MISSING_SPAWN')
  if (!a || !a.scaleReference) errors.push('MISSING_SCALE_REFERENCE')

  // Tier-specific stage-screen shape.
  if (a?.stageScreen) {
    const ss = a.stageScreen as Record<string, unknown>
    if (m.tier === 'PANO_360' && ss.kind !== 'angular') errors.push('PANO_REQUIRES_ANGULAR_STAGE')
    if (m.tier === 'NAV_MESH' && ss.kind !== 'rect') errors.push('MESH_REQUIRES_NODE_STAGE')
    // Aspect warning only applies to rect screens; renderer letterboxes others.
    if (
      ss.kind === 'rect' &&
      typeof ss.widthM === 'number' &&
      typeof ss.heightM === 'number' &&
      ss.heightM > 0
    ) {
      const aspect = ss.widthM / ss.heightM
      const target = 16 / 9
      if (Math.abs(aspect - target) / target > 0.05) warnings.push('STAGE_SCREEN_NOT_16_9')
    }
  }

  if (a?.scaleReference && !(a.scaleReference.realMeters > 0)) {
    errors.push('INVALID_SCALE_REFERENCE')
  }

  if (Array.isArray(m.adSurfaces)) {
    for (const s of m.adSurfaces) {
      const ok =
        isObject(s) &&
        typeof s.id === 'string' &&
        s.id.length > 0 &&
        typeof s.widthM === 'number' &&
        s.widthM > 0 &&
        typeof s.heightM === 'number' &&
        s.heightM > 0
      if (!ok) {
        errors.push('AD_SURFACE_INVALID')
        break
      }
    }
  }

  if (!m.rights || m.rights.ownerWarrantsRights !== true) errors.push('RIGHTS_NOT_WARRANTED')

  return { ok: errors.length === 0, errors, warnings }
}
