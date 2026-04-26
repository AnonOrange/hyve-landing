// Hyve Encryption — application-layer encryption for Sentinel/Scout audit data.
//
// Threat model:
//   - The audit table contains data that, if leaked, would re-expose the user's
//     systems to the same attackers we're protecting them from (asset identifiers,
//     vulnerable endpoint paths, vendor signatures).
//   - We must protect against: database breach, employee with read-only DB access,
//     log/backup leak, accidental export.
//   - We accept that someone with both the master key AND application code can
//     decrypt — encryption protects against data-only compromise, not full server
//     takeover (no system can defend against that).
//
// Design:
//   - AES-256-GCM (NIST-standard authenticated encryption, native to node:crypto)
//   - Per-audit key derivation via HKDF-SHA256(master, salt=auditId, info='hyve-sentinel')
//     so a single compromised audit doesn't leak others
//   - Ciphertext format: base64( iv (12) | ciphertext | authTag (16) )
//   - Master key is 32 random bytes, base64-encoded in env var HYVE_AUDIT_ENCRYPTION_KEY
//
// The master key NEVER appears in DB rows, code constants, or logs. It exists
// only in the runtime environment.

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto'

const MASTER_KEY_B64 = process.env.HYVE_AUDIT_ENCRYPTION_KEY || ''
let MASTER_KEY: Buffer | null = null

function getMasterKey(): Buffer {
  if (MASTER_KEY) return MASTER_KEY
  if (!MASTER_KEY_B64) {
    throw new Error('HYVE_AUDIT_ENCRYPTION_KEY not set — audit data cannot be encrypted')
  }
  const buf = Buffer.from(MASTER_KEY_B64, 'base64')
  if (buf.length !== 32) {
    throw new Error(`HYVE_AUDIT_ENCRYPTION_KEY must be exactly 32 bytes after base64 decode (got ${buf.length})`)
  }
  MASTER_KEY = buf
  return buf
}

function deriveAuditKey(auditId: string): Buffer {
  // HKDF derives a per-audit 32-byte key from the master + audit id salt.
  // Same audit id always produces the same derived key.
  const ikm = getMasterKey()
  const salt = Buffer.from(auditId, 'utf-8')
  const info = Buffer.from('hyve-sentinel-v1', 'utf-8')
  return Buffer.from(hkdfSync('sha256', ikm, salt, info, 32))
}

/**
 * Encrypt a string under a per-audit key. Returns base64-encoded ciphertext
 * blob (iv + ciphertext + auth tag). Empty/null input passes through.
 */
export function encrypt(auditId: string, plaintext: string | null | undefined): string | null {
  if (plaintext == null || plaintext === '') return plaintext == null ? null : ''
  const key = deriveAuditKey(auditId)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, ciphertext, authTag]).toString('base64')
}

/**
 * Decrypt a string previously encrypted with `encrypt(auditId, ...)`. If the
 * input doesn't look like a Hyve ciphertext (e.g., legacy plaintext from
 * before encryption was added), it's passed through unchanged.
 */
export function decrypt(auditId: string, ciphertextB64: string | null | undefined): string | null {
  if (ciphertextB64 == null || ciphertextB64 === '') return ciphertextB64 == null ? null : ''
  // Heuristic: real ciphertext is base64 with length >= 28 (12 IV + min 1 + 16 tag = 29 → 40 b64 chars).
  // Plaintext that happens to be valid base64 is rare for our content (signatures, paths) but possible.
  // We'll attempt decrypt and fall back to passthrough on failure.
  try {
    const blob = Buffer.from(ciphertextB64, 'base64')
    if (blob.length < 28) return ciphertextB64 // too short to be valid ciphertext
    const iv = blob.subarray(0, 12)
    const authTag = blob.subarray(blob.length - 16)
    const ciphertext = blob.subarray(12, blob.length - 16)
    const key = deriveAuditKey(auditId)
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    return plaintext.toString('utf-8')
  } catch {
    return ciphertextB64
  }
}

/**
 * Encrypt an object's string fields recursively (for remediation_steps which
 * is an array). Non-string leaves pass through unchanged.
 */
export function encryptDeep(auditId: string, value: any): any {
  if (typeof value === 'string') return encrypt(auditId, value)
  if (Array.isArray(value)) return value.map((v) => encryptDeep(auditId, v))
  if (value && typeof value === 'object') {
    const out: any = {}
    for (const k of Object.keys(value)) out[k] = encryptDeep(auditId, value[k])
    return out
  }
  return value
}

export function decryptDeep(auditId: string, value: any): any {
  if (typeof value === 'string') return decrypt(auditId, value)
  if (Array.isArray(value)) return value.map((v) => decryptDeep(auditId, v))
  if (value && typeof value === 'object') {
    const out: any = {}
    for (const k of Object.keys(value)) out[k] = decryptDeep(auditId, value[k])
    return out
  }
  return value
}
