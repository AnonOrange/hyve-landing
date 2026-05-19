// HYVE Attend audit log — appends an attend_audit_logs row for a sensitive
// action (review decisions, refund decisions, payouts, …). Spec §10.
import { supaPost } from '@/lib/supabase'

export interface AuditEntry {
  actorId: string | null
  action: string
  entityType: string
  entityId: string | null
  metadata?: Record<string, unknown>
}

/**
 * Append an audit row. A failed write is logged, not thrown — auditing must
 * not fail the action it records.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  const res = await supaPost(
    'attend_audit_logs',
    {
      actor_id: entry.actorId,
      actor_type: 'HUMAN',
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      metadata: entry.metadata ?? {},
    },
    'return=minimal',
  )
  if (!res.ok) console.error(`[attend audit] write failed: ${res.status}`)
}
