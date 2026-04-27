// src/lib/admin/session.ts
//
// Session storage via Supabase — no external KV dependency.
// Sessions expire at a fixed TTL; middleware checks expires_at column.
// Uses fetch-based supaGet/supaPost/supaPatch/supaDelete so it runs on
// both Node and Edge runtimes (middleware).

import { supaGet, supaPost, supaPatch, supaDelete } from '@/lib/supabase'

export interface AdminSession {
  id: string
  admin_id: string
  email: string
  role: 'owner' | 'admin'
  ip: string
  created_at: string
  last_active_at: string
  expires_at: string
}

export const SESSION_TTL_SEC = 24 * 60 * 60

function generateId(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function expiresAt(): string {
  return new Date(Date.now() + SESSION_TTL_SEC * 1000).toISOString()
}

export async function createSession(params: {
  admin_id: string
  email: string
  role: 'owner' | 'admin'
  ip: string
}): Promise<string> {
  const id = generateId()
  await supaPost('admin_sessions', {
    id,
    ...params,
    expires_at: expiresAt(),
  }, 'return=minimal')
  return id
}

export async function lookupSession(id: string): Promise<AdminSession | null> {
  if (!/^[0-9a-f]{64}$/.test(id)) return null
  const now = new Date().toISOString()
  const res = await supaGet(
    'admin_sessions',
    `id=eq.${encodeURIComponent(id)}&expires_at=gt.${encodeURIComponent(now)}&limit=1`,
  )
  if (!res.ok) return null
  const rows = await res.json() as AdminSession[]
  return rows[0] ?? null
}

export async function refreshSession(id: string): Promise<void> {
  await supaPatch('admin_sessions', `id=eq.${encodeURIComponent(id)}`, {
    last_active_at: new Date().toISOString(),
    expires_at: expiresAt(),
  })
}

export async function deleteSession(id: string): Promise<void> {
  await supaDelete('admin_sessions', `id=eq.${encodeURIComponent(id)}`)
}

export async function deleteAllSessionsForEmail(email: string): Promise<void> {
  await supaDelete('admin_sessions', `email=eq.${encodeURIComponent(email)}`)
}
