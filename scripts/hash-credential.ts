#!/usr/bin/env tsx
// scripts/hash-credential.ts
//
// Usage:
//   npm run hash-credential
//
// Interactively hashes a password and PIN at bcrypt cost 12.
// Outputs the hashes to copy into Vercel env vars.
// Never stores the plaintext values.

import bcrypt from 'bcryptjs'
import { createInterface } from 'node:readline'

const rl = createInterface({ input: process.stdin, output: process.stdout })

function prompt(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    if (hidden) process.stdout.write(question)
    rl.question(hidden ? '' : question, (answer) => {
      if (hidden) process.stdout.write('\n')
      resolve(answer)
    })
  })
}

async function main() {
  console.log('\nHYVE Admin Credential Hasher')
  console.log('─────────────────────────────')
  console.log('Input is NOT echoed. Values are hashed and never stored.\n')

  const email = await prompt('Admin email: ')
  const password = await prompt('Password (≥12 chars): ', true)
  const pin = await prompt('PIN (exactly 6 digits): ', true)

  if (password.length < 12) {
    console.error('ERROR: Password must be at least 12 characters')
    process.exit(1)
  }
  if (!/^\d{6}$/.test(pin)) {
    console.error('ERROR: PIN must be exactly 6 digits')
    process.exit(1)
  }

  console.log('\nHashing (cost 12, may take a few seconds)…\n')
  const [passwordHash, pinHash] = await Promise.all([
    bcrypt.hash(password, 12),
    bcrypt.hash(pin, 12),
  ])

  console.log('Set these env vars on Vercel (production only — never commit):')
  console.log('─────────────────────────────────────────────────────────────')
  console.log(`ADMIN_SEED_EMAIL=${email}`)
  console.log(`ADMIN_SEED_PASSWORD_HASH=${passwordHash}`)
  console.log(`ADMIN_SEED_PIN_HASH=${pinHash}`)
  console.log('─────────────────────────────────────────────────────────────\n')

  rl.close()
}

main().catch((err) => { console.error(err); process.exit(1) })
