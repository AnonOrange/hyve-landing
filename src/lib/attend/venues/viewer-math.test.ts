import { describe, it, expect } from 'vitest'
import { anglesToDirection, stagePanelSize } from '@/lib/attend/venues/viewer-math'

const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 5)

describe('anglesToDirection', () => {
  it('centre faces -Z (forward)', () => {
    const d = anglesToDirection(0, 0)
    near(d.x, 0)
    near(d.y, 0)
    near(d.z, -1)
  })
  it('+90 azimuth faces +X', () => {
    const d = anglesToDirection(90, 0)
    near(d.x, 1)
    near(d.y, 0)
    near(d.z, 0)
  })
  it('+90 elevation faces +Y (up)', () => {
    const d = anglesToDirection(0, 90)
    near(d.x, 0)
    near(d.y, 1)
    near(d.z, 0)
  })
  it('180 azimuth faces +Z (behind)', () => {
    const d = anglesToDirection(180, 0)
    near(d.z, 1)
  })
})

describe('stagePanelSize', () => {
  it('90° hFov at radius 10 → width 20, 16:9 height', () => {
    const s = stagePanelSize(90, 10)
    near(s.width, 20)
    near(s.height, 20 / (16 / 9))
  })
})
