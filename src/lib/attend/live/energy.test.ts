import { describe, it, expect } from 'vitest'
import { energyLevel } from '@/lib/attend/live/energy'

describe('energyLevel', () => {
  it('is 0 with no reactions', () => {
    expect(energyLevel(0)).toBe(0)
    expect(energyLevel(-3)).toBe(0)
  })
  it('rises with the reaction count', () => {
    expect(energyLevel(5)).toBeGreaterThan(0)
    expect(energyLevel(10)).toBeGreaterThan(energyLevel(5))
  })
  it('returns a mid value for a mid count', () => {
    expect(energyLevel(10)).toBe(50)
  })
  it('clamps at 100', () => {
    expect(energyLevel(20)).toBe(100)
    expect(energyLevel(1000)).toBe(100)
  })
})
