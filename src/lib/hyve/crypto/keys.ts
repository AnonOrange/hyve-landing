import { x25519, ed25519 } from '@noble/curves/ed25519.js'

export interface X25519Keypair {
  privateKey: Uint8Array
  publicKey: Uint8Array
}

export interface Ed25519Keypair {
  privateKey: Uint8Array
  publicKey: Uint8Array
}

export function generateX25519Keypair(): X25519Keypair {
  const privateKey = x25519.utils.randomSecretKey()
  const publicKey = x25519.getPublicKey(privateKey)
  return { privateKey, publicKey }
}

export function generateEd25519Keypair(): Ed25519Keypair {
  const privateKey = ed25519.utils.randomSecretKey()
  const publicKey = ed25519.getPublicKey(privateKey)
  return { privateKey, publicKey }
}

export function x25519DH(privateKey: Uint8Array, theirPublicKey: Uint8Array): Uint8Array {
  return x25519.getSharedSecret(privateKey, theirPublicKey)
}

export function ed25519Sign(privateKey: Uint8Array, message: Uint8Array): Uint8Array {
  return ed25519.sign(message, privateKey)
}

export function ed25519Verify(signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array): boolean {
  try {
    return ed25519.verify(signature, message, publicKey)
  } catch {
    return false
  }
}

export function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n))
}
