// Integer-cents money helper for HYVE Attend. All amounts are integer
// cents; no floating-point money math anywhere (spec §5 money convention).

function assertIntCents(cents: number): void {
  if (!Number.isInteger(cents)) {
    throw new Error(`money: expected integer cents, got ${cents}`)
  }
}

/**
 * Take `percent` percent of an integer-cent amount, rounding half up.
 * `percent` is a human percentage (2.5 means 2.5%), not a fraction.
 */
export function percentOf(cents: number, percent: number): number {
  assertIntCents(cents)
  // Scale to avoid floating error: (cents * percent * 10) / 1000, round half up.
  const scaled = cents * percent * 10
  return Math.floor((scaled + 500) / 1000)
}

/** Sum a list of integer-cent amounts. */
export function sumCents(amounts: number[]): number {
  let total = 0
  for (const a of amounts) {
    assertIntCents(a)
    total += a
  }
  return total
}

/** Format integer cents as a USD string, e.g. 2500 -> "$25.00". */
export function formatUsd(cents: number): string {
  assertIntCents(cents)
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}
