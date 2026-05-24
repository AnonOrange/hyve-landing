import { describe, it, expect } from 'vitest'
import { validateManifest } from '@/lib/attend/venues/manifest-validator'

const validMesh = {
  manifestVersion: '1.0',
  tier: 'NAV_MESH',
  asset: { type: 'glb', files: ['main.glb'] },
  world: { unit: 'meter', upAxis: 'Y', forwardAxis: '-Z' },
  anchors: {
    stageScreen: { kind: 'rect', node: 'ANCHOR_stage_screen', widthM: 8, heightM: 4.5 },
    spawn: { positionM: [0, 1.6, 12], yawDeg: 0 },
    scaleReference: { description: 'door', realMeters: 2.03 },
  },
  capture: { method: 'matterport', capturedAt: '2026-05-24', operator: 'hyve-contracted' },
  rights: { ownerWarrantsRights: true, brandingCleared: true },
}

describe('validateManifest — core', () => {
  it('accepts a well-formed mesh manifest', () => {
    const r = validateManifest(validMesh)
    expect(r.ok).toBe(true)
    expect(r.errors).toEqual([])
  })

  it('rejects wrong unit and missing version', () => {
    const r = validateManifest({
      ...validMesh,
      manifestVersion: '',
      world: { ...validMesh.world, unit: 'feet' },
    })
    expect(r.ok).toBe(false)
    expect(r.errors).toContain('MISSING_MANIFEST_VERSION')
    expect(r.errors).toContain('WRONG_UNIT')
  })

  it('rejects missing required anchors', () => {
    const r = validateManifest({ ...validMesh, anchors: {} })
    expect(r.errors).toContain('MISSING_STAGE_SCREEN')
    expect(r.errors).toContain('MISSING_SPAWN')
    expect(r.errors).toContain('MISSING_SCALE_REFERENCE')
  })

  it('rejects non-object input with NOT_AN_OBJECT', () => {
    expect(validateManifest(null).errors).toContain('NOT_AN_OBJECT')
    expect(validateManifest('x').errors).toContain('NOT_AN_OBJECT')
  })
})

describe('validateManifest — tier shape + scale + aspect', () => {
  it('rejects a pano manifest that uses a rect stage screen', () => {
    const r = validateManifest({
      ...validMesh,
      tier: 'PANO_360',
      asset: { type: 'equirect', files: ['pano.jpg'] },
    })
    expect(r.errors).toContain('PANO_REQUIRES_ANGULAR_STAGE')
  })

  it('rejects a mesh manifest with an angular stage screen', () => {
    const r = validateManifest({
      ...validMesh,
      anchors: {
        ...validMesh.anchors,
        stageScreen: { kind: 'angular', azimuthDeg: 0, elevationDeg: 0, hFovDeg: 60 },
      },
    })
    expect(r.errors).toContain('MESH_REQUIRES_NODE_STAGE')
  })

  it('rejects non-positive scale reference', () => {
    const r = validateManifest({
      ...validMesh,
      anchors: { ...validMesh.anchors, scaleReference: { description: 'door', realMeters: 0 } },
    })
    expect(r.errors).toContain('INVALID_SCALE_REFERENCE')
  })

  it('warns (does not reject) when a rect stage screen is not 16:9', () => {
    const r = validateManifest({
      ...validMesh,
      anchors: {
        ...validMesh.anchors,
        stageScreen: { kind: 'rect', node: 'ANCHOR_stage_screen', widthM: 4, heightM: 4 },
      },
    })
    expect(r.ok).toBe(true)
    expect(r.warnings).toContain('STAGE_SCREEN_NOT_16_9')
  })
})

describe('validateManifest — ad surfaces', () => {
  it('accepts a manifest with valid ad surfaces', () => {
    const r = validateManifest({
      ...validMesh,
      adSurfaces: [{ id: 'lobby-1', kind: 'rect', node: 'ANCHOR_ad_1', widthM: 3, heightM: 1 }],
    })
    expect(r.ok).toBe(true)
  })

  it('rejects an ad surface with empty id or non-positive dims', () => {
    const r = validateManifest({
      ...validMesh,
      adSurfaces: [{ id: '', kind: 'rect', widthM: 0, heightM: 1 }],
    })
    expect(r.errors).toContain('AD_SURFACE_INVALID')
  })

  it('treats a missing adSurfaces array as valid (optional)', () => {
    expect(validateManifest(validMesh).ok).toBe(true)
  })
})
