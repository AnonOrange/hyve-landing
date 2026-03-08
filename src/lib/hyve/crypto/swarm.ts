/**
 * HYVE Swarm: assembles N data cells + cover cells for one message,
 * and reconstructs messages from received cells.
 */

import { chacha20poly1305 } from '@noble/ciphers/chacha.js'
import { gcm } from '@noble/ciphers/aes.js'
import { hkdf, concat, uint32BE, uint16BE } from './hkdf'
import { randomBytes } from './keys'
import { shamirSplit, shamirReconstruct, ShamirShare } from './shamir'
import {
  assembleCell, disassembleCell, buildHeader, CellContents,
  CELL_PAYLOAD_SIZE, HEADER_SIZE,
} from './cell'

const DEFAULT_N = 5
const DEFAULT_K = 3
const COVER_CELLS = 2
const JSON_BUDGET = 359  // 387 - 12 nonce - 16 tag

const encoder = new TextEncoder()
const decoder = new TextDecoder()

/** Encrypt the JSON payload (359-byte budget) with a fresh messageKey. */
function encryptPayload(json: object): { ciphertext: Uint8Array; messageKey: Uint8Array } {
  const messageKey = randomBytes(32)
  const nonce = randomBytes(12)
  const raw = encoder.encode(JSON.stringify(json))

  // Pad to exactly JSON_BUDGET bytes
  const plain = new Uint8Array(JSON_BUDGET)
  plain.set(raw.slice(0, JSON_BUDGET))

  const cipher = gcm(messageKey, nonce)
  const encrypted = cipher.encrypt(plain) // 359 + 16 = 375 bytes

  // Pack as nonce(12) + ciphertext+tag(375) = 387 bytes
  const payload = new Uint8Array(CELL_PAYLOAD_SIZE)
  payload.set(nonce, 0)
  payload.set(encrypted, 12)

  return { ciphertext: payload, messageKey }
}

/** Decrypt the 387-byte innerPayload back to a JSON object. */
export function decryptPayload(payload: Uint8Array): object | null {
  if (payload.length < CELL_PAYLOAD_SIZE) return null
  const nonce = payload.slice(0, 12)
  const ciphertext = payload.slice(12, CELL_PAYLOAD_SIZE) // 375 bytes

  // We need the messageKey — this is called after Shamir reconstruction gives us the key
  // This function is exposed but callers pass the reconstructed key separately — see decryptPayloadWithKey
  return null
}

export function decryptPayloadWithKey(payload: Uint8Array, messageKey: Uint8Array): object | null {
  try {
    const nonce = payload.slice(0, 12)
    const ciphertext = payload.slice(12)
    const cipher = gcm(messageKey, nonce)
    const plain = cipher.decrypt(ciphertext)
    // Trim null padding
    let end = plain.length
    while (end > 0 && plain[end - 1] === 0) end--
    return JSON.parse(decoder.decode(plain.slice(0, end)))
  } catch {
    return null
  }
}

/** Derive the per-cell cellKey from chainKey + routingToken. */
function deriveCellKey(chainKey: Uint8Array, routingToken: Uint8Array): Uint8Array {
  return hkdf(concat(chainKey, routingToken), 'HYVE Cell Key v1.0', 32)
}

/** Derive the routing token for one cell. */
function deriveRoutingToken(
  chainKey: Uint8Array,
  swarmId: Uint8Array,
  cellSeq: number,
  inboxPrefix: Uint8Array,  // 8 bytes — first 8 bytes override
): Uint8Array {
  const seqBytes = new Uint8Array(4)
  new DataView(seqBytes.buffer).setUint32(0, cellSeq, false)
  const token = hkdf(concat(chainKey, swarmId, seqBytes), 'HYVE BRT v1.0', 32)
  // Overwrite first 8 bytes with recipient inbox prefix
  token.set(inboxPrefix.slice(0, 8), 0)
  return token
}

/**
 * Assemble N data cells + COVER_CELLS cover cells for one message.
 * Returns array of 512-byte Uint8Arrays (7 cells total).
 */
export function assembleSwarm(
  jsonPayload: object,
  chainKey: Uint8Array,
  inboxPrefix: Uint8Array,   // 8-byte recipient inbox prefix
  epoch: number,
  shamirK = DEFAULT_K,
  shamirN = DEFAULT_N,
): Uint8Array[] {
  const swarmId = randomBytes(16)
  const { ciphertext: innerPayload, messageKey } = encryptPayload(jsonPayload)
  const shares = shamirSplit(messageKey, shamirN, shamirK)

  const cells: Uint8Array[] = []

  // Data cells
  for (let seq = 0; seq < shamirN; seq++) {
    const routingToken = deriveRoutingToken(chainKey, swarmId, seq, inboxPrefix)
    const cellKey = deriveCellKey(chainKey, routingToken)
    const header = buildHeader(0x00, swarmId, epoch, seq, shamirN, shamirK, routingToken)
    const share = shares[seq]
    cells.push(assembleCell(header, share.x, share.y, innerPayload, cellKey))
  }

  // Cover cells (flags = 0x01)
  for (let c = 0; c < COVER_CELLS; c++) {
    const seq = shamirN + c
    const routingToken = deriveRoutingToken(chainKey, swarmId, seq, inboxPrefix)
    const cellKey = deriveCellKey(chainKey, routingToken)
    const header = buildHeader(0x01, swarmId, epoch, seq, shamirN, shamirK, routingToken)
    const dummyShare = randomBytes(32)
    const dummyPayload = new Uint8Array(CELL_PAYLOAD_SIZE)
    crypto.getRandomValues(dummyPayload)
    cells.push(assembleCell(header, 0, dummyShare, dummyPayload, cellKey))
  }

  return cells
}

/** State for reconstructing one swarm from incoming cells. */
interface SwarmAccumulator {
  shares: ShamirShare[]
  payload: Uint8Array | null
  shamirK: number
}

const _accumulators = new Map<string, SwarmAccumulator>()

/** Process one received cell. Returns decrypted JSON if swarm is complete. */
export function tryReconstruct(
  raw: Uint8Array,
  chainKey: Uint8Array,
): object | null {
  if (raw.length !== 512) return null

  // Parse header without decrypting to get swarmId + routing token
  const header = raw.slice(0, 64)
  const routingToken = header.slice(32, 64)
  const flags = header[1]

  // Skip cover cells
  if (flags & 0x01) return null

  const dv = new DataView(raw.buffer, raw.byteOffset)
  const swarmIdBytes = header.slice(2, 18)
  const swarmKey = Array.from(swarmIdBytes).join(',')
  const shamirK = header[26]

  // Try to decrypt with current chainKey
  const cellKey = deriveCellKey(chainKey, routingToken)
  const contents = disassembleCell(raw, cellKey)
  if (!contents) return null

  // Accumulate share
  let acc = _accumulators.get(swarmKey)
  if (!acc) {
    acc = { shares: [], payload: null, shamirK }
    _accumulators.set(swarmKey, acc)
  }

  if (!acc.payload) acc.payload = contents.innerPayload
  acc.shares.push({ x: contents.shamirX, y: contents.shamirShare })

  if (acc.shares.length >= acc.shamirK) {
    _accumulators.delete(swarmKey)
    try {
      const messageKey = shamirReconstruct(acc.shares.slice(0, acc.shamirK))
      return decryptPayloadWithKey(acc.payload, messageKey)
    } catch {
      return null
    }
  }

  return null
}
