// Build valid venue manifests from intake inputs. Pure — the upload flows
// feed in the placement. Tier-1 (360°) is self-serve; Tier-2 (mesh) is the
// contracted/admin path.
import type { VenueManifest, ScaleReference } from '@/lib/attend/venues/manifest-types'

export interface Pano360Input {
  file: string
  stageAzimuthDeg: number
  stageElevationDeg: number
  stageHFovDeg: number
  scaleReference: ScaleReference
  capturedAt: string
  method: string
  operator: 'venue' | 'hyve-contracted'
  ownerWarrantsRights: boolean
  brandingCleared: boolean
}

export function buildPano360Manifest(input: Pano360Input): VenueManifest {
  return {
    manifestVersion: '1.0',
    tier: 'PANO_360',
    asset: { type: 'equirect', files: [input.file] },
    world: { unit: 'meter', upAxis: 'Y', forwardAxis: '-Z' },
    anchors: {
      stageScreen: {
        kind: 'angular',
        azimuthDeg: input.stageAzimuthDeg,
        elevationDeg: input.stageElevationDeg,
        hFovDeg: input.stageHFovDeg,
      },
      spawn: { positionM: [0, 1.6, 0], yawDeg: input.stageAzimuthDeg },
      scaleReference: input.scaleReference,
    },
    capture: { method: input.method, capturedAt: input.capturedAt, operator: input.operator },
    rights: {
      ownerWarrantsRights: input.ownerWarrantsRights,
      brandingCleared: input.brandingCleared,
    },
  }
}

export interface NavMeshInput {
  /** Storage path of the optimized .glb */
  file: string
  /** Name of the stage-screen empty node inside the glb */
  stageNode: string
  stageWidthM: number
  stageHeightM: number
  spawnPositionM: [number, number, number]
  spawnYawDeg: number
  scaleReference: ScaleReference
  capturedAt: string
  method: string
  operator: 'venue' | 'hyve-contracted'
  ownerWarrantsRights: boolean
  brandingCleared: boolean
}

/** Build a Tier-2 (NAV_MESH) manifest for a contracted .glb scan. */
export function buildNavMeshManifest(input: NavMeshInput): VenueManifest {
  return {
    manifestVersion: '1.0',
    tier: 'NAV_MESH',
    asset: { type: 'glb', files: [input.file] },
    world: { unit: 'meter', upAxis: 'Y', forwardAxis: '-Z' },
    anchors: {
      stageScreen: {
        kind: 'rect',
        node: input.stageNode,
        widthM: input.stageWidthM,
        heightM: input.stageHeightM,
      },
      spawn: { positionM: input.spawnPositionM, yawDeg: input.spawnYawDeg },
      scaleReference: input.scaleReference,
    },
    capture: { method: input.method, capturedAt: input.capturedAt, operator: input.operator },
    rights: {
      ownerWarrantsRights: input.ownerWarrantsRights,
      brandingCleared: input.brandingCleared,
    },
  }
}
