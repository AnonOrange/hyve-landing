/**
 * HYVE web vault: PBKDF2(PIN, 100k) → AES-GCM encrypt identity → IndexedDB
 */

import { dbGet, dbPut } from './db'

const VAULT_KEY = 'identity'
const PBKDF2_ITERATIONS = 100_000

async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: new Uint8Array(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

interface VaultEntry {
  salt: number[]    // 16 bytes
  nonce: number[]   // 12 bytes
  ciphertext: number[]
}

export async function isSetup(): Promise<boolean> {
  const entry = await dbGet<VaultEntry>('vault', VAULT_KEY)
  return entry !== undefined
}

export async function createVault(identity: object, pin: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const nonce = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(pin, salt)
  const plaintext = new TextEncoder().encode(JSON.stringify(identity))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, plaintext)
  const entry: VaultEntry = {
    salt: Array.from(salt),
    nonce: Array.from(nonce),
    ciphertext: Array.from(new Uint8Array(ciphertext)),
  }
  await dbPut('vault', VAULT_KEY, entry)
}

export async function unlockVault(pin: string): Promise<object | null> {
  const entry = await dbGet<VaultEntry>('vault', VAULT_KEY)
  if (!entry) return null
  try {
    const salt = new Uint8Array(entry.salt)
    const nonce = new Uint8Array(entry.nonce)
    const ciphertext = new Uint8Array(entry.ciphertext)
    const key = await deriveKey(pin, salt)
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ciphertext)
    return JSON.parse(new TextDecoder().decode(plaintext))
  } catch {
    return null  // wrong PIN
  }
}

/** Overwrite vault with updated identity (e.g. after consuming OPK). */
export async function updateVault(identity: object, pin: string): Promise<void> {
  await createVault(identity, pin)
}

/**
 * Import an identity from an Android link code (base64 JSON).
 * Stores it as the vault identity without publishing a new bundle.
 * The existing bundle on the HYVE-ID server (from the phone) remains valid.
 */
export async function importIdentityBundle(exportCode: string, pin: string): Promise<void> {
  const rawBytes = Uint8Array.from(atob(exportCode), c => c.charCodeAt(0))
  const data = JSON.parse(new TextDecoder().decode(rawBytes))
  await createVault(data, pin)
}
