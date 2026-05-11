// src/lib/admin/audit.ts
//
// Append-only writes to admin_audit_log. Fire-and-forget safe — callers
// should not await if they don't need confirmation. Failures are swallowed
// (analytics, not critical path).

import { supaPost } from '@/lib/supabase'

export type AuditAction =
  | 'sign_in'
  | 'sign_out'
  | 'invite'
  | 'invite_accepted'
  | 'revoke'
  | 'role_change'
  | 'login_fail'
  | 'reset_requested'
  | 'password_reset'
  | 'scan'
  | 'comp_grant'    // free lifetime Pro access granted to an email
  | 'comp_revoke'   // free lifetime Pro access revoked
  | 'caseline_comp_key_issue'   // admin minted a complimentary CaseLine desktop key
  | 'caseline_comp_key_revoke'  // admin revoked a complimentary CaseLine desktop key

export interface AuditEntry {
  actor_email: string
  action: AuditAction
  target_email?: string | null
  detail?: string | null
  ip?: string | null
}

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await supaPost('admin_audit_log', entry, 'return=minimal')
  } catch {
    // Audit log failures must never break the primary operation
  }
}
