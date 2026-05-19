// HYVE Attend — transfer code generation. A friend code is read aloud and
// typed by hand, so its alphabet omits 0/O/1/I/L; a claim token rides in an
// email link and is high-entropy. Both are backstopped by unique constraints
// on attend_ticket_transfers.
import { randomBytes, randomInt } from 'crypto'

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function block(): string {
  let s = ''
  for (let i = 0; i < 4; i++) s += ALPHABET[randomInt(ALPHABET.length)]
  return s
}

/** A shareable one-time friend code, e.g. HYVE-7K2M-PQ4R. */
export function friendCode(): string {
  return `HYVE-${block()}-${block()}`
}

/** A 192-bit URL-safe token for an email transfer's claim link. */
export function claimToken(): string {
  return randomBytes(24).toString('base64url')
}
