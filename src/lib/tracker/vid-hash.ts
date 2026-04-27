// src/lib/tracker/vid-hash.ts
//
// Daily-rotating SHA-256 visitor hash. Properties:
//   - Same visitor in same UTC day  → same vid_hash (countable unique)
//   - Same visitor across days      → different vid_hash (cannot correlate)
//   - Server cannot reverse the hash to recover visitor_uuid

export async function computeVidHash(visitorId: string, dateUtc: string): Promise<string> {
  const secret = process.env.SECRET_SALT ?? 'dev-salt'

  // daily_salt = SHA-256(SECRET_SALT + YYYY-MM-DD)
  const saltInput = new TextEncoder().encode(secret + dateUtc)
  const saltBuf = await crypto.subtle.digest('SHA-256', saltInput)
  const dailySalt = bufToHex(saltBuf)

  // vid_hash = SHA-256(visitor_uuid + ':' + daily_salt)
  const hashInput = new TextEncoder().encode(visitorId + ':' + dailySalt)
  const hashBuf = await crypto.subtle.digest('SHA-256', hashInput)
  return bufToHex(hashBuf)
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

export function utcDateString(now = new Date()): string {
  return now.toISOString().slice(0, 10)  // YYYY-MM-DD
}
