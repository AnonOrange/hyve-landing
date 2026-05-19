import { describe, it, expect } from 'vitest'
import { slugifyTitle, uniqueSlug } from '@/lib/attend/events/slug'

describe('slugifyTitle', () => {
  it('lowercases, trims, and hyphenates', () => {
    expect(slugifyTitle('  Midnight Live!  ')).toBe('midnight-live')
    expect(slugifyTitle('AI & Friends: Show #2')).toBe('ai-friends-show-2')
  })
  it('collapses repeated separators', () => {
    expect(slugifyTitle('a   ---   b')).toBe('a-b')
  })
  it('falls back for an empty result', () => {
    expect(slugifyTitle('!!!')).toBe('event')
  })
})

describe('uniqueSlug', () => {
  it('returns the base slug when it is free', () => {
    expect(uniqueSlug('midnight-live', [])).toBe('midnight-live')
  })
  it('appends the smallest free numeric suffix on collision', () => {
    expect(uniqueSlug('midnight-live', ['midnight-live'])).toBe('midnight-live-2')
    expect(uniqueSlug('midnight-live', ['midnight-live', 'midnight-live-2'])).toBe('midnight-live-3')
  })
})
