import { NextRequest, NextResponse } from 'next/server'
import { supaDelete } from '@/lib/supabase'

export const runtime = 'nodejs'

const CRON_SECRET = process.env.CRON_SECRET

export async function GET(req: NextRequest) {
  const auth = req.headers.get('Authorization')
  const got = auth?.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!CRON_SECRET || got !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Supabase PostgREST uses filter operators for range deletes.
  // lt.<timestamp> deletes rows older than the threshold.
  const now = new Date()
  const cutoffs = {
    traffic_events:         daysAgo(now, 60),
    admin_audit_log:        daysAgo(now, 180),
    admin_invites:          daysAgo(now, 30),   // by expires_at
    admin_password_resets:  daysAgo(now, 30),   // by expires_at
  }

  const results = await Promise.allSettled([
    supaDelete('traffic_events', `ts=lt.${cutoffs.traffic_events}`),
    supaDelete('admin_audit_log', `ts=lt.${cutoffs.admin_audit_log}`),
    supaDelete('admin_invites', `expires_at=lt.${cutoffs.admin_invites}`),
    supaDelete('admin_password_resets', `expires_at=lt.${cutoffs.admin_password_resets}`),
  ])

  const errors = results
    .filter((r) => r.status === 'rejected')
    .map((r) => (r as PromiseRejectedResult).reason?.message ?? 'unknown')

  return NextResponse.json({ ok: true, errors: errors.length ? errors : undefined })
}

function daysAgo(from: Date, days: number): string {
  return new Date(from.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
}
