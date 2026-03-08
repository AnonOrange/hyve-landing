/**
 * HYVE X3DH handshake — byte-compatible with message_service.dart
 */

import { hkdf, concat, toHex, fromHex, toBase64url, fromBase64url } from './hkdf'
import { x25519DH, generateX25519Keypair, X25519Keypair } from './keys'

export interface PeerBundle {
  hyveId: string
  ikPub: string      // hex
  spkPub: string     // hex
  spkSig: string     // hex
  opk?: string       // hex, optional
}

export interface X3DHHeader {
  ek: string         // base64url ephemeral pub
  ik: string         // base64url sender IK pub
  opk_used: boolean
  opk_pub?: string   // base64url OPK pub consumed
}

export interface X3DHResult {
  sharedSecret: Uint8Array  // 64 bytes
  header: X3DHHeader
  ekPair: X25519Keypair
}

/** Alice initiates X3DH to Bob. Returns 64-byte shared secret + header to embed in first message. */
export function x3dhInitiate(
  myIkPriv: Uint8Array,
  myIkPub: Uint8Array,
  peer: PeerBundle,
): X3DHResult {
  const ekPair = generateX25519Keypair()
  const peerIkPub = fromHex(peer.ikPub)
  const peerSpkPub = fromHex(peer.spkPub)
  const peerOpkPub = peer.opk ? fromHex(peer.opk) : null

  const dh1 = x25519DH(myIkPriv, peerSpkPub)
  const dh2 = x25519DH(ekPair.privateKey, peerIkPub)
  const dh3 = x25519DH(ekPair.privateKey, peerSpkPub)

  let dhInput = concat(dh1, dh2, dh3)
  let opkUsed = false

  if (peerOpkPub) {
    const dh4 = x25519DH(ekPair.privateKey, peerOpkPub)
    dhInput = concat(dhInput, dh4)
    opkUsed = true
  }

  const sharedSecret = hkdf(dhInput, 'HYVE X3DH v1.0', 64)

  const header: X3DHHeader = {
    ek: toBase64url(ekPair.publicKey),
    ik: toBase64url(myIkPub),
    opk_used: opkUsed,
    ...(opkUsed && peerOpkPub ? { opk_pub: toBase64url(peerOpkPub) } : {}),
  }

  return { sharedSecret, header, ekPair }
}

/** Bob responds to Alice's X3DH. Returns 64-byte shared secret. */
export function x3dhRespond(
  myIkPriv: Uint8Array,
  mySpkPriv: Uint8Array,
  opkPool: Array<{ pub: Uint8Array; priv: Uint8Array }>,
  header: X3DHHeader,
): Uint8Array {
  const aliceIkPub = fromBase64url(header.ik)
  const aliceEkPub = fromBase64url(header.ek)

  const dh1 = x25519DH(mySpkPriv, aliceIkPub)
  const dh2 = x25519DH(myIkPriv, aliceEkPub)
  const dh3 = x25519DH(mySpkPriv, aliceEkPub)

  let dhInput = concat(dh1, dh2, dh3)

  if (header.opk_used && header.opk_pub) {
    const opkPubBytes = fromBase64url(header.opk_pub)
    const opkPubHex = toHex(opkPubBytes)
    const opk = opkPool.find(o => toHex(o.pub) === opkPubHex)
    if (opk) {
      const dh4 = x25519DH(opk.priv, aliceEkPub)
      dhInput = concat(dhInput, dh4)
    }
  }

  return hkdf(dhInput, 'HYVE X3DH v1.0', 64)
}
