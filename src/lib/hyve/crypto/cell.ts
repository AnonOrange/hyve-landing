/**
 * HYVE 512-byte cell assembly / disassembly.
 *
 * Layout:
 *   [0..63]   header (64 bytes, AAD for AEAD)
 *   [64..75]  nonce  (12 bytes)
 *   [76..495] ciphertext (420 bytes)
 *   [496..511] auth tag  (16 bytes)
 *
 * Header layout:
 *   [0]     version  = 0x01
 *   [1]     flags    (isCover=0x01, isFinalChunk=0x02)
 *   [2..17] swarmId  (16 bytes random)
 *   [18..21] epoch   (uint32 BE)
 *   [22..23] cellSeq (uint16 BE)
 *   [24..25] totalDataCells (uint16 BE)
 *   [26]    shamirK
 *   [27..31] reserved (zeros)
 *   [32..63] routingToken (32 bytes)
 *
 * Encrypted payload (420 bytes plaintext):
 *   [0]     shamirX (0 for cover)
 *   [1..32] shamirShare (32 bytes)
 *   [33..419] innerPayload (387 bytes)
 */

import { chacha20poly1305 } from '@noble/ciphers/chacha.js'
import { randomBytes } from './keys'
import { uint32BE, uint16BE } from './hkdf'

export const CELL_SIZE = 512
export const HEADER_SIZE = 64
export const NONCE_SIZE = 12
export const TAG_SIZE = 16
export const ENCRYPTED_SIZE = 420      // plaintext size of the cell body
export const CELL_PAYLOAD_SIZE = 387   // innerPayload bytes per cell

export interface CellHeader {
  version: number
  flags: number
  swarmId: Uint8Array
  epoch: number
  cellSeq: number
  totalDataCells: number
  shamirK: number
  routingToken: Uint8Array
}

export interface CellContents {
  header: CellHeader
  shamirX: number
  shamirShare: Uint8Array   // 32 bytes
  innerPayload: Uint8Array  // 387 bytes
}

export function buildHeader(
  flags: number,
  swarmId: Uint8Array,
  epoch: number,
  cellSeq: number,
  totalDataCells: number,
  shamirK: number,
  routingToken: Uint8Array,
): Uint8Array {
  const h = new Uint8Array(HEADER_SIZE)
  h[0] = 0x01           // version
  h[1] = flags
  h.set(swarmId, 2)     // [2..17]
  h.set(uint32BE(epoch), 18)
  h.set(uint16BE(cellSeq), 22)
  h.set(uint16BE(totalDataCells), 24)
  h[26] = shamirK
  // [27..31] reserved = 0
  h.set(routingToken, 32)
  return h
}

export function assembleCell(
  header: Uint8Array,         // 64 bytes
  shamirX: number,
  shamirShare: Uint8Array,    // 32 bytes
  innerPayload: Uint8Array,   // 387 bytes
  cellKey: Uint8Array,        // 32 bytes
): Uint8Array {
  // Build 420-byte plaintext
  const plain = new Uint8Array(ENCRYPTED_SIZE)
  plain[0] = shamirX
  plain.set(shamirShare, 1)
  plain.set(innerPayload.slice(0, CELL_PAYLOAD_SIZE), 33)

  // Encrypt with ChaCha20-Poly1305
  const nonce = randomBytes(NONCE_SIZE)
  const cipher = chacha20poly1305(cellKey, nonce, header)
  const ciphertext = cipher.encrypt(plain)  // 420 + 16 = 436 bytes

  // Assemble 512 bytes: header(64) + nonce(12) + ciphertext(420) + tag(16)
  const cell = new Uint8Array(CELL_SIZE)
  cell.set(header, 0)
  cell.set(nonce, 64)
  cell.set(ciphertext, 76)   // ciphertext includes the 16-byte tag at the end
  return cell
}

export function parseHeader(raw: Uint8Array): CellHeader {
  const dv = new DataView(raw.buffer, raw.byteOffset)
  return {
    version: raw[0],
    flags: raw[1],
    swarmId: raw.slice(2, 18),
    epoch: dv.getUint32(18, false),
    cellSeq: dv.getUint16(22, false),
    totalDataCells: dv.getUint16(24, false),
    shamirK: raw[26],
    routingToken: raw.slice(32, 64),
  }
}

export function disassembleCell(
  raw: Uint8Array,     // 512 bytes
  cellKey: Uint8Array, // 32 bytes
): CellContents | null {
  if (raw.length !== CELL_SIZE) return null
  const header = raw.slice(0, HEADER_SIZE)
  const nonce = raw.slice(HEADER_SIZE, HEADER_SIZE + NONCE_SIZE)
  const ciphertext = raw.slice(HEADER_SIZE + NONCE_SIZE) // 436 bytes (420 cipher + 16 tag)

  try {
    const cipher = chacha20poly1305(cellKey, nonce, header)
    const plain = cipher.decrypt(ciphertext) // 420 bytes
    return {
      header: parseHeader(header),
      shamirX: plain[0],
      shamirShare: plain.slice(1, 33),
      innerPayload: plain.slice(33),
    }
  } catch {
    return null
  }
}

export function isCover(flags: number): boolean {
  return (flags & 0x01) !== 0
}
