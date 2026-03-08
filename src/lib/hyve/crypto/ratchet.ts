/**
 * HYVE Double Ratchet — byte-compatible with hyve_ratchet.dart
 */

import { hkdf, concat } from './hkdf'
import { generateX25519Keypair, x25519DH, X25519Keypair } from './keys'

export interface RatchetState {
  rootKey: Uint8Array
  sendChainKey: Uint8Array
  recvChainKey: Uint8Array
  sendDhPair: X25519Keypair
  remoteDhPub: Uint8Array | null
  epoch: number
  sendCount: number
  recvCount: number
}

export interface SendResult {
  messageKey: Uint8Array
  chainKey: Uint8Array
  dhPub: Uint8Array
  epoch: number
}

/** Initialize ratchet as Alice (initiator). */
export function initSenderRatchet(sharedSecret: Uint8Array, peerSpkPub: Uint8Array): RatchetState {
  const rootKey0 = hkdf(sharedSecret, 'HYVE RK Init v1.0', 32)
  const chainKey0 = hkdf(sharedSecret, 'HYVE CK Init v1.0', 32)

  // Initial DH ratchet step with peer's SPK
  const sendDhPair = generateX25519Keypair()
  const dh = x25519DH(sendDhPair.privateKey, peerSpkPub)
  const rkInput = concat(rootKey0, dh)
  const rootKey1 = hkdf(rkInput, 'HYVE RK v1.0', 32)
  const sendChainKey1 = hkdf(rkInput, 'HYVE CK Boot v1.0', 32)

  return {
    rootKey: rootKey1,
    sendChainKey: sendChainKey1,
    recvChainKey: chainKey0,
    sendDhPair,
    remoteDhPub: peerSpkPub,
    epoch: 1,
    sendCount: 0,
    recvCount: 0,
  }
}

/** Initialize ratchet as Bob (responder). */
export function initReceiverRatchet(sharedSecret: Uint8Array): RatchetState {
  const rootKey = hkdf(sharedSecret, 'HYVE RK Init v1.0', 32)
  const chainKey = hkdf(sharedSecret, 'HYVE CK Init v1.0', 32)
  const sendDhPair = generateX25519Keypair()

  return {
    rootKey,
    sendChainKey: chainKey,
    recvChainKey: chainKey,
    sendDhPair,
    remoteDhPub: null,
    epoch: 0,
    sendCount: 0,
    recvCount: 0,
  }
}

/** Advance send chain: returns messageKey + updated state. */
export function ratchetSend(state: RatchetState): { result: SendResult; nextState: RatchetState } {
  const messageKey = hkdf(state.sendChainKey, 'HYVE MK v1.0', 32)
  const nextChainKey = hkdf(state.sendChainKey, 'HYVE CK v1.0', 32)

  const result: SendResult = {
    messageKey,
    chainKey: state.sendChainKey,  // pre-advance — matches Android chainKeySeed
    dhPub: state.sendDhPair.publicKey,
    epoch: state.epoch,
  }

  return {
    result,
    nextState: {
      ...state,
      sendChainKey: nextChainKey,
      sendCount: state.sendCount + 1,
    },
  }
}

/** Advance receive chain: returns messageKey + updated state. */
export function ratchetReceive(
  state: RatchetState,
  theirDhPub: Uint8Array,
): { messageKey: Uint8Array; nextState: RatchetState } {
  const theirDhHex = Array.from(theirDhPub).join(',')
  const remoteDhHex = state.remoteDhPub ? Array.from(state.remoteDhPub).join(',') : ''

  // If new DH pub, do a DH ratchet step
  if (theirDhHex !== remoteDhHex) {
    // Receive DH step
    const dh1 = x25519DH(state.sendDhPair.privateKey, theirDhPub)
    const rkInput1 = concat(state.rootKey, dh1)
    const recvChainKey = hkdf(rkInput1, 'HYVE CK Boot v1.0', 32)
    const rootKey1 = hkdf(rkInput1, 'HYVE RK v1.0', 32)

    // Send DH step with new keypair
    const newDhPair = generateX25519Keypair()
    const dh2 = x25519DH(newDhPair.privateKey, theirDhPub)
    const rkInput2 = concat(rootKey1, dh2)
    const sendChainKey = hkdf(rkInput2, 'HYVE CK Boot v1.0', 32)
    const rootKey2 = hkdf(rkInput2, 'HYVE RK v1.0', 32)

    const newState: RatchetState = {
      rootKey: rootKey2,
      sendChainKey,
      recvChainKey,
      sendDhPair: newDhPair,
      remoteDhPub: theirDhPub,
      epoch: state.epoch + 1,
      sendCount: 0,
      recvCount: 0,
    }

    // Now advance receive chain once
    const messageKey = hkdf(newState.recvChainKey, 'HYVE MK v1.0', 32)
    const nextRecvChainKey = hkdf(newState.recvChainKey, 'HYVE CK v1.0', 32)

    return {
      messageKey,
      nextState: { ...newState, recvChainKey: nextRecvChainKey, recvCount: 1 },
    }
  }

  // Same DH pub — symmetric receive step
  const messageKey = hkdf(state.recvChainKey, 'HYVE MK v1.0', 32)
  const nextRecvChainKey = hkdf(state.recvChainKey, 'HYVE CK v1.0', 32)

  return {
    messageKey,
    nextState: { ...state, recvChainKey: nextRecvChainKey, recvCount: state.recvCount + 1 },
  }
}

/** Serialize ratchet state to JSON-safe object. */
export function serializeRatchet(state: RatchetState): object {
  const toHex = (b: Uint8Array) => Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('')
  return {
    rootKey: toHex(state.rootKey),
    sendChainKey: toHex(state.sendChainKey),
    recvChainKey: toHex(state.recvChainKey),
    sendDhPriv: toHex(state.sendDhPair.privateKey),
    sendDhPub: toHex(state.sendDhPair.publicKey),
    remoteDhPub: state.remoteDhPub ? toHex(state.remoteDhPub) : null,
    epoch: state.epoch,
    sendCount: state.sendCount,
    recvCount: state.recvCount,
  }
}

export function deserializeRatchet(obj: Record<string, unknown>): RatchetState {
  const fromHex = (s: string) => {
    const b = new Uint8Array(s.length / 2)
    for (let i = 0; i < b.length; i++) b[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16)
    return b
  }
  return {
    rootKey: fromHex(obj.rootKey as string),
    sendChainKey: fromHex(obj.sendChainKey as string),
    recvChainKey: fromHex(obj.recvChainKey as string),
    sendDhPair: {
      privateKey: fromHex(obj.sendDhPriv as string),
      publicKey: fromHex(obj.sendDhPub as string),
    },
    remoteDhPub: obj.remoteDhPub ? fromHex(obj.remoteDhPub as string) : null,
    epoch: obj.epoch as number,
    sendCount: obj.sendCount as number,
    recvCount: obj.recvCount as number,
  }
}
