// src/lib/admin/session.ts
//
// Opaque 64-char hex session IDs stored in Vercel KV with 24h sliding TTL.
// Sessions are revocable instantly; a secondary set per email lets us kill all
// sessions for a given admin on revoke or password reset.
//
// ⚠️ Imported by middleware.ts (Edge runtime). Must use Web Crypto only —
// do NOT import node:crypto here.

import { kv } from '@/lib/kv'

export interface AdminSession {
  admin_id: string
  email: string
  role: 'owner' | 'admin'
  ip: string
  createdAt: number      // unix ms
  lastActiveAt: number   // unix ms
}

export const SESSION_TTL_SEC = 24 * 60 * 60

function generateId(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function createSession(params: Omit<AdminSession, 'createdAt' | 'lastActiveAt'>): Promise<string> {
  const id = generateId()
  const now = Date.now()
  const session: AdminSession = { ...params, createdAt: now, lastActiveAt: now }
  await Promise.all([
    kv.set(`session:${id}`, session, { ex: SESSION_TTL_SEC }),
    kv.sadd(`admin_sessions:${params.email}`, id),
    kv.expire(`admin_sessions:${params.email}`, SESSION_TTL_SEC * 7),  // index TTL = 7d max
  ])
  return id
}

export async function lookupSession(id: string): Promise<AdminSession | null> {
  if (!/^[0-9a-f]{64}$/.test(id)) return null
  return kv.get<AdminSession>(`session:${id}`)
}

export async function refreshSession(id: string, session: AdminSession): Promise<void> {
  session.lastActiveAt = Date.now()
  await kv.set(`session:${id}`, session, { ex: SESSION_TTL_SEC })
}

export async function deleteSession(id: string): Promise<void> {
  const session = await lookupSession(id)
  const delOps: Promise<unknown>[] = [kv.del(`session:${id}`)]
  if (session) delOps.push(kv.srem(`admin_sessions:${session.email}`, id))
  await Promise.all(delOps)
}

export async function deleteAllSessionsForEmail(email: string): Promise<void> {
  const ids = (await kv.smembers(`admin_sessions:${email}`)) as string[]
  if (!ids.length) return
  await Promise.all([
    ...ids.map((id) => kv.del(`session:${id}`)),
    kv.del(`admin_sessions:${email}`),
  ])
}
