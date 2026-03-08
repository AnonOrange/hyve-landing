/**
 * HYVE-CST: Shamir Secret Sharing over GF(2^8)
 * AES irreducible polynomial: x^8 + x^4 + x^3 + x + 1 (0x11b)
 * Byte-compatible with hyve-app/lib/core/crypto/shamir.dart
 */

import { randomBytes } from './keys'

const POLY = 0x11b

function gfMul(a: number, b: number): number {
  let result = 0
  let aa = a & 0xFF
  let bb = b & 0xFF
  while (bb > 0) {
    if (bb & 1) result ^= aa
    const highBit = (aa & 0x80) !== 0
    aa = (aa << 1) & 0xFF
    if (highBit) aa ^= (POLY & 0xFF)
    bb >>= 1
  }
  return result & 0xFF
}

function gfInv(a: number): number {
  if (a === 0) return 0
  let result = 1
  let base = a & 0xFF
  let exp = 254
  while (exp > 0) {
    if (exp & 1) result = gfMul(result, base)
    base = gfMul(base, base)
    exp >>= 1
  }
  return result
}

function gfDiv(a: number, b: number): number {
  return gfMul(a, gfInv(b))
}

export interface ShamirShare {
  x: number       // 1..255
  y: Uint8Array   // 32 bytes
}

export function shamirSplit(secret: Uint8Array, n: number, k: number): ShamirShare[] {
  if (secret.length !== 32) throw new Error('Secret must be 32 bytes')
  if (k < 2 || n < k || n > 255) throw new Error('Invalid n/k')

  const shareValues: Uint8Array[] = Array.from({ length: n }, () => new Uint8Array(32))

  for (let byteIdx = 0; byteIdx < 32; byteIdx++) {
    const coeffs = new Uint8Array(k)
    coeffs[0] = secret[byteIdx]
    const rand = randomBytes(k - 1)
    for (let j = 1; j < k; j++) coeffs[j] = rand[j - 1]

    for (let x = 1; x <= n; x++) {
      let y = 0
      let xPow = 1
      for (let j = 0; j < k; j++) {
        y ^= gfMul(coeffs[j], xPow)
        xPow = gfMul(xPow, x)
      }
      shareValues[x - 1][byteIdx] = y
    }
  }

  return shareValues.map((y, i) => ({ x: i + 1, y }))
}

export function shamirReconstruct(shares: ShamirShare[]): Uint8Array {
  const secret = new Uint8Array(32)

  for (let byteIdx = 0; byteIdx < 32; byteIdx++) {
    let value = 0
    for (let i = 0; i < shares.length; i++) {
      const xi = shares[i].x
      const yi = shares[i].y[byteIdx]
      let numerator = 1
      let denominator = 1
      for (let j = 0; j < shares.length; j++) {
        if (i === j) continue
        const xj = shares[j].x
        numerator = gfMul(numerator, xj)
        denominator = gfMul(denominator, xi ^ xj)
      }
      const lagrange = gfDiv(numerator, denominator)
      value ^= gfMul(yi, lagrange)
    }
    secret[byteIdx] = value
  }

  return secret
}
