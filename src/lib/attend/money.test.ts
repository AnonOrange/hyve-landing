import { describe, it, expect } from 'vitest'
import { percentOf, formatUsd, sumCents } from '@/lib/attend/money'

describe('percentOf', () => {
  it('takes a basis-point percentage of an integer-cent amount', () => {
    expect(percentOf(10_000, 2.5)).toBe(250)   // 2.5% of $100.00 = $2.50
    expect(percentOf(2_500, 2.5)).toBe(63)     // 2.5% of $25.00 = 62.5c -> 63 (round half up)
    expect(percentOf(2_500, 5.5)).toBe(138)    // 5.5% of $25.00 = 137.5c -> 138
    expect(percentOf(0, 2.5)).toBe(0)
  })

  it('rounds half up deterministically', () => {
    expect(percentOf(2_100, 2.5)).toBe(53)     // 52.5 -> 53
    expect(percentOf(2_020, 2.5)).toBe(51)     // 50.5 -> 51
  })

  it('rejects non-integer cent input', () => {
    expect(() => percentOf(100.5, 2.5)).toThrow()
  })
})

describe('sumCents', () => {
  it('adds integer-cent amounts', () => {
    expect(sumCents([100, 250, 30])).toBe(380)
    expect(sumCents([])).toBe(0)
  })
})

describe('formatUsd', () => {
  it('formats integer cents as a USD string', () => {
    expect(formatUsd(2_500)).toBe('$25.00')
    expect(formatUsd(0)).toBe('$0.00')
    expect(formatUsd(99)).toBe('$0.99')
  })
})
