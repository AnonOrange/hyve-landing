import { describe, it, expect } from 'vitest'
import { buildVenueAssetRecord } from '@/lib/attend/venues/venue-record'

const base = {
  venueId: 'v1',
  tier: 'NAV_MESH' as const,
  manifest: { any: 'json' } as never,
  storagePath: 'venues/v1/scan1',
  actor: 'creator:123',
}

describe('buildVenueAssetRecord', () => {
  it('marks VALIDATED with no errors when validation passes', () => {
    const r = buildVenueAssetRecord({
      ...base,
      validation: { ok: true, errors: [], warnings: [] },
    })
    expect(r.status).toBe('VALIDATED')
    expect(r.validation_errors).toBeNull()
    expect(r.validation_warnings).toBeNull()
    expect(r.venue_id).toBe('v1')
    expect(r.created_by).toBe('creator:123')
  })

  it('marks REJECTED and stores the error codes when validation fails', () => {
    const r = buildVenueAssetRecord({
      ...base,
      validation: { ok: false, errors: ['MISSING_SPAWN'], warnings: [] },
    })
    expect(r.status).toBe('REJECTED')
    expect(r.validation_errors).toEqual(['MISSING_SPAWN'])
  })

  it('stores warnings even when VALIDATED', () => {
    const r = buildVenueAssetRecord({
      ...base,
      validation: { ok: true, errors: [], warnings: ['STAGE_SCREEN_NOT_16_9'] },
    })
    expect(r.status).toBe('VALIDATED')
    expect(r.validation_warnings).toEqual(['STAGE_SCREEN_NOT_16_9'])
  })
})
