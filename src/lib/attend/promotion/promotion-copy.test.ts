import { describe, it, expect } from 'vitest'
import { generateStarterCreative } from '@/lib/attend/promotion/promotion-copy'

describe('generateStarterCreative', () => {
  it('builds a headline from the event title', () => {
    const c = generateStarterCreative({
      title: 'Midnight Set',
      description: null,
    })
    expect(c.headline).toBe('Midnight Set — live on HYVE')
  })

  it('uses the description for the body when present', () => {
    const c = generateStarterCreative({
      title: 'Midnight Set',
      description: '  A late-night ambient session.  ',
    })
    expect(c.body).toBe('A late-night ambient session.')
  })

  it('falls back to a generated body when there is no description', () => {
    const c = generateStarterCreative({
      title: 'Midnight Set',
      description: null,
    })
    expect(c.body).toContain('Midnight Set')
    expect(c.body.length).toBeGreaterThan(0)
  })

  it('clamps a very long title in the headline', () => {
    const c = generateStarterCreative({
      title: 'X'.repeat(200),
      description: null,
    })
    expect(c.headline.length).toBeLessThanOrEqual(80)
    expect(c.headline.endsWith('…')).toBe(true)
  })

  it('clamps a very long description in the body', () => {
    const c = generateStarterCreative({
      title: 'Set',
      description: 'word '.repeat(100),
    })
    expect(c.body.length).toBeLessThanOrEqual(180)
  })

  it('normalises whitespace and tolerates an empty title', () => {
    const c = generateStarterCreative({
      title: '   ',
      description: 'line\n\nbreak',
    })
    expect(c.headline).toBe('A live show — live on HYVE')
    expect(c.body).toBe('line break')
  })
})
