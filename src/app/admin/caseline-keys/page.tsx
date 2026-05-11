// /admin/caseline-keys — admin panel for issuing + revoking comp
// (complimentary) Hyve CaseLine license keys.

import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin/get-session'
import { supaGet } from '@/lib/supabase'
import AdminShell from '../_shell'
import CompKeysClient from './_client'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'CaseLine Keys · HYVE Admin' }

export default async function CaselineKeysPage() {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')

  // Threat/scan snapshots — same SSR shape every admin page uses so the
  // shell header renders consistently.
  const snapsRes = await supaGet('snapshots', 'key=in.(threat_level,last_cron)&select=key,payload')
  const snaps = snapsRes.ok
    ? Object.fromEntries((await snapsRes.json() as { key: string; payload: unknown }[]).map(r => [r.key, r.payload]))
    : {}
  const threat   = snaps.threat_level as { level: 'low'|'guarded'|'elevated'|'high'|'critical'; score: number; signals: Array<{ kind: string; severity: number }> } | null
  const lastCron = snaps.last_cron as { ts: number } | null

  return (
    <AdminShell session={session} threat={threat} lastScanTs={lastCron?.ts ?? null} activePath="/admin/caseline-keys">
      <CompKeysClient />
    </AdminShell>
  )
}
