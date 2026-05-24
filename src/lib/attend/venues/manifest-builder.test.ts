import { describe, it, expect } from 'vitest'
import {
  buildPano360Manifest,
  buildNavMeshManifest,
  buildSplatManifest,
} from '@/lib/attend/venues/manifest-builder'
import { validateManifest } from '@/lib/attend/venues/manifest-validator'

const meshInput = {
  file: 'venue.glb',
  stageNode: 'ANCHOR_stage_screen',
  stageWidthM: 8,
  stageHeightM: 4.5,
  spawnPositionM: [0, 1.6, 10] as [number, number, number],
  spawnYawDeg: 0,
  scaleReference: { description: 'door', realMeters: 2.03 },
  capturedAt: '2026-05-24',
  method: 'hyve-contracted',
  operator: 'hyve-contracted' as const,
  ownerWarrantsRights: true,
  brandingCleared: true,
}

describe('buildNavMeshManifest', () => {
  it('produces a NAV_MESH manifest that validates', () => {
    const m = buildNavMeshManifest(meshInput)
    expect(m.tier).toBe('NAV_MESH')
    expect(m.asset.type).toBe('glb')
    expect(validateManifest(m).ok).toBe(true)
  })
})

describe('buildSplatManifest', () => {
  it('produces a SPLAT manifest with a proxy that validates', () => {
    const m = buildSplatManifest({ ...meshInput, file: 'scene.ksplat', proxyFile: 'proxy.glb' })
    expect(m.tier).toBe('SPLAT')
    expect(m.asset.type).toBe('splat')
    expect(m.asset.splatProxy).toBe('proxy.glb')
    expect(validateManifest(m).ok).toBe(true)
  })

  it('rejects a SPLAT manifest missing its proxy', () => {
    const m = buildSplatManifest({ ...meshInput, file: 'scene.ksplat', proxyFile: 'proxy.glb' })
    const noProxy = { ...m, asset: { ...m.asset, splatProxy: null } }
    const r = validateManifest(noProxy)
    expect(r.ok).toBe(false)
    expect(r.errors).toContain('SPLAT_REQUIRES_PROXY')
  })
})

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
