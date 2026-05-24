// Build a valid Tier-1 (360°) venue manifest from self-serve inputs.
// Pure — the upload UI feeds it the user's stage-screen placement.
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
