import { describe, it, expect } from 'vitest'
import { friendCode, claimToken } from '@/lib/attend/transfers/transfer-codes'

describe('friendCode', () => {
  it('matches HYVE-XXXX-XXXX with an unambiguous alphabet (no 0/O/1/I/L)', () => {
    for (let i = 0; i < 50; i++) {
      expect(friendCode()).toMatch(/^HYVE-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/)
    }
  })
  it('produces distinct codes', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 500; i++) seen.add(friendCode())
    expect(seen.size).toBe(500)
  })
})

describe('claimToken', () => {
  it('is a URL-safe token of length >= 32', () => {
    const t = claimToken()
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(t.length).toBeGreaterThanOrEqual(32)
  })
  it('produces distinct tokens', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 500; i++) seen.add(claimToken())
    expect(seen.size).toBe(500)
  })
})
