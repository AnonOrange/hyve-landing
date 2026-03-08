/**
 * HYVE identity management — mirrors identity.dart
 */

import { generateX25519Keypair, generateEd25519Keypair, ed25519Sign, X25519Keypair, Ed25519Keypair } from './crypto/keys'
import { hkdf, toHex, fromHex } from './crypto/hkdf'
import { PublicBundle } from './network/hyve_id'

const OPK_INITIAL_COUNT = 20

export interface OPKEntry {
  pub: string   // hex
  priv: string  // hex
}

export interface Identity {
  hyveId: string
  /** X25519 identity keypair (for DH) */
  ikPub: string   // hex
  ikPriv: string  // hex
  /** Ed25519 signing keypair */
  skPub: string   // hex
  skPriv: string  // hex
  /** Signed prekey (X25519) */
  spkPub: string  // hex
  spkPriv: string // hex
  spkSig: string  // hex
  /** One-time prekeys */
  opkPool: OPKEntry[]
  /** Inbox prefix (8 bytes) derived from IK pub */
  inboxPrefix: string  // hex (8 bytes)
  /** Bootstrap chain key from SPK */
  bootstrapKey: string // hex (32 bytes)
  createdAt: number
}

export function createIdentity(hyveId: string): Identity {
  const clean = hyveId.trim().replace(/^@/, '')

  const ikPair: X25519Keypair = generateX25519Keypair()
  const skPair: Ed25519Keypair = generateEd25519Keypair()
  const spkPair: X25519Keypair = generateX25519Keypair()

  // Sign SPK pub with identity signing key (Ed25519)
  const spkSig = ed25519Sign(skPair.privateKey, spkPair.publicKey)

  // Generate OPK pool
  const opkPool: OPKEntry[] = []
  for (let i = 0; i < OPK_INITIAL_COUNT; i++) {
    const kp = generateX25519Keypair()
    opkPool.push({ pub: toHex(kp.publicKey), priv: toHex(kp.privateKey) })
  }

  // Inbox prefix: HKDF(ikPub, "HYVE Inbox v1.0")[0:8]
  const inboxFull = hkdf(ikPair.publicKey, 'HYVE Inbox v1.0', 8)
  const inboxPrefix = toHex(inboxFull)

  // Bootstrap key: HKDF(spkPub, "HYVE Bootstrap v1.0", 32)
  const bootstrapKey = toHex(hkdf(spkPair.publicKey, 'HYVE Bootstrap v1.0', 32))

  return {
    hyveId: clean,
    ikPub: toHex(ikPair.publicKey),
    ikPriv: toHex(ikPair.privateKey),
    skPub: toHex(skPair.publicKey),
    skPriv: toHex(skPair.privateKey),
    spkPub: toHex(spkPair.publicKey),
    spkPriv: toHex(spkPair.privateKey),
    spkSig: toHex(spkSig),
    opkPool,
    inboxPrefix,
    bootstrapKey,
    createdAt: Date.now(),
  }
}

export function buildPublicBundle(identity: Identity): PublicBundle {
  return {
    hyveId: identity.hyveId,
    ikPub: identity.ikPub,
    spkPub: identity.spkPub,
    spkSig: identity.spkSig,
    opkBundle: identity.opkPool.map(o => o.pub),
  }
}

/** Reconstruct a web Identity from an Android export bundle (base64 JSON). */
export function identityFromExport(exportCode: string): Identity {
  const rawBytes = Uint8Array.from(atob(exportCode), c => c.charCodeAt(0))
  const data = JSON.parse(new TextDecoder().decode(rawBytes)) as Record<string, unknown>

  const ikPub  = fromHex(data.ikPub  as string)
  const spkPub = fromHex(data.spkPub as string)

  const inboxPrefix  = toHex(hkdf(ikPub,  'HYVE Inbox v1.0',      8))
  const bootstrapKey = toHex(hkdf(spkPub, 'HYVE Bootstrap v1.0', 32))

  return {
    hyveId:       (data.hyveId as string).replace(/^@/, ''),
    ikPub:        data.ikPub  as string,
    ikPriv:       data.ikPriv as string,
    skPub:        data.skPub  as string,
    skPriv:       data.skPriv as string,
    spkPub:       data.spkPub  as string,
    spkPriv:      data.spkPriv as string,
    spkSig:       data.spkSig  as string,
    opkPool:      data.opkPool as OPKEntry[],
    inboxPrefix,
    bootstrapKey,
    createdAt:    Date.now(),
  }
}

export function getInboxPrefix(identity: Identity): Uint8Array {
  return fromHex(identity.inboxPrefix)
}

export function getBootstrapKey(identity: Identity): Uint8Array {
  return fromHex(identity.bootstrapKey)
}

/** Derive inboxPrefix for a peer from their IK pub. */
export function peerInboxPrefix(peerIkPub: Uint8Array): Uint8Array {
  return hkdf(peerIkPub, 'HYVE Inbox v1.0', 8)
}
