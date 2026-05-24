import { describe, it, expect } from 'vitest'
import { buildPano360Manifest } from '@/lib/attend/venues/manifest-builder'
import { validateManifest } from '@/lib/attend/venues/manifest-validator'

describe('buildPano360Manifest', () => {
  it('produces a PANO_360 manifest that passes validation', () => {
    const m = buildPano360Manifest({
      file: 'pano.jpg',
      stageAzimuthDeg: 10,
      stageElevationDeg: -2,
      stageHFovDeg: 55,
      scaleReference: { description: 'main door', realMeters: 2.03 },
      capturedAt: '2026-05-24',
      method: 'insta360x4',
      operator: 'venue',
      ownerWarrantsRights: true,
      brandingCleared: true,
    })
    expect(m.tier).toBe('PANO_360')
    expect(m.asset).toEqual({ type: 'equirect', files: ['pano.jpg'] })
    expect(m.anchors.stageScreen).toMatchObject({ kind: 'angular', azimuthDeg: 10, hFovDeg: 55 })
    expect(validateManifest(m).ok).toBe(true)
  })
})
