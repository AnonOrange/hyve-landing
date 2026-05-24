import { describe, it, expect } from 'vitest'
import { equirectClickToAngles } from '@/lib/attend/venues/equirect'

describe('equirectClickToAngles', () => {
  it('maps image centre to forward + horizon', () => {
    expect(equirectClickToAngles(1000, 500, 2000, 1000)).toEqual({
      azimuthDeg: 0,
      elevationDeg: 0,
    })
  })

  it('maps left edge to -180 azimuth, top to +90 elevation', () => {
    expect(equirectClickToAngles(0, 0, 2000, 1000)).toEqual({
      azimuthDeg: -180,
      elevationDeg: 90,
    })
  })

  it('maps bottom to -90 elevation', () => {
    expect(equirectClickToAngles(1000, 1000, 2000, 1000)).toEqual({
      azimuthDeg: 0,
      elevationDeg: -90,
    })
  })

  it('clamps out-of-bounds clicks', () => {
    const r = equirectClickToAngles(-50, 5000, 2000, 1000)
    expect(r.azimuthDeg).toBe(-180)
    expect(r.elevationDeg).toBe(-90)
  })
})
