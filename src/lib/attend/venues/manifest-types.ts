// Venue scan manifest — the contract between a venue's 3D/360 scan and the
// HYVE Attend renderer. See docs/superpowers/specs/2026-05-24-venue-3d-scan-
// requirements-design.md. Pure types; no I/O.

export type VenueTier = 'PANO_360' | 'NAV_MESH'

export type StageScreenAnchor =
  | { kind: 'rect'; node: string; widthM: number; heightM: number; aspect?: string }
  | { kind: 'angular'; azimuthDeg: number; elevationDeg: number; hFovDeg: number }

export interface SpawnAnchor {
  positionM: [number, number, number]
  yawDeg: number
}

export interface ScaleReference {
  description: string
  realMeters: number
}

export interface AdSurface {
  id: string
  kind: 'rect'
  node?: string
  widthM: number
  heightM: number
}

export interface VenueManifest {
  manifestVersion: string
  tier: VenueTier
  asset: { type: 'equirect' | 'glb'; files: string[]; splatProxy?: string | null }
  world: { unit: 'meter'; upAxis: 'Y'; forwardAxis: '-Z' }
  anchors: {
    stageScreen: StageScreenAnchor
    spawn: SpawnAnchor
    scaleReference: ScaleReference
  }
  adSurfaces?: AdSurface[]
  capture: { method: string; capturedAt: string; operator: 'venue' | 'hyve-contracted' }
  rights: { ownerWarrantsRights: boolean; brandingCleared: boolean }
}

export type ManifestErrorCode =
  | 'NOT_AN_OBJECT'
  | 'MISSING_MANIFEST_VERSION'
  | 'UNSUPPORTED_TIER'
  | 'WRONG_UNIT'
  | 'WRONG_UP_AXIS'
  | 'ASSET_MISSING_FILES'
  | 'MISSING_STAGE_SCREEN'
  | 'PANO_REQUIRES_ANGULAR_STAGE'
  | 'MESH_REQUIRES_NODE_STAGE'
  | 'MISSING_SPAWN'
  | 'MISSING_SCALE_REFERENCE'
  | 'INVALID_SCALE_REFERENCE'
  | 'AD_SURFACE_INVALID'
  | 'RIGHTS_NOT_WARRANTED'

export type ManifestWarningCode = 'STAGE_SCREEN_NOT_16_9'

export interface ManifestValidation {
  ok: boolean
  errors: ManifestErrorCode[]
  warnings: ManifestWarningCode[]
}
