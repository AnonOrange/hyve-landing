// src/lib/admin/ratelimit.ts
//
// Lightweight rate-limit counters backed by Supabase admin_rate_limits table.
// Not atomically incremented (non-issue at 2-5 concurrent admin users).

import { supaGet, supaPost, supaPatch, supaDelete } from '@/lib/supabase'

interface RateLimitRow {
  key: string
  count: number
  expires_at: string
}

export async function getRateCount(key: string): Promise<number> {
  const now = new Date().toISOString()
  const res = await supaGet(
    'admin_rate_limits',
    `key=eq.${encodeURIComponent(key)}&expires_at=gt.${encodeURIComponent(now)}&limit=1`,
  )
  if (!res.ok) return 0
  const rows = await res.json() as RateLimitRow[]
  return rows[0]?.count ?? 0
}

export async function incrementRateCount(key: string, ttlSec: number): Promise<number> {
  const now = new Date().toISOString()
  const expires_at = new Date(Date.now() + ttlSec * 1000).toISOString()

  // Check if an active entry exists
  const checkRes = await supaGet(
    'admin_rate_limits',
    `key=eq.${encodeURIComponent(key)}&expires_at=gt.${encodeURIComponent(now)}&limit=1`,
  )
  if (checkRes.ok) {
    const rows = await checkRes.json() as RateLimitRow[]
    const existing = rows[0]
    if (existing) {
      const newCount = existing.count + 1
      await supaPatch('admin_rate_limits', `key=eq.${encodeURIComponent(key)}`, { count: newCount })
      return newCount
    }
  }

  // No active entry — insert fresh (delete any expired entry first)
  await supaDelete('admin_rate_limits', `key=eq.${encodeURIComponent(key)}`)
  await supaPost('admin_rate_limits', { key, count: 1, expires_at }, 'return=minimal')
  return 1
}

export async function clearRateCount(key: string): Promise<void> {
  await supaDelete('admin_rate_limits', `key=eq.${encodeURIComponent(key)}`)
}
