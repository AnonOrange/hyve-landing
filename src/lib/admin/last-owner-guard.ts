// src/lib/admin/last-owner-guard.ts
//
// Prevents revoke or role-demotion that would leave zero active owners.
// Call before any UPDATE that changes role or active flag on an owner row.

import { supaGet } from '@/lib/supabase'

export class LastOwnerError extends Error {
  constructor() {
    super('Cannot remove the last active owner — promote another admin to owner first.')
    this.name = 'LastOwnerError'
  }
}

export async function assertNotLastOwner(targetAdminId: string): Promise<void> {
  const res = await supaGet('admins', 'role=eq.owner&active=eq.true&select=id')
  if (!res.ok) throw new Error('Failed to query owner count')

  const owners = await res.json() as { id: string }[]
  const otherOwners = owners.filter((o) => o.id !== targetAdminId)

  if (otherOwners.length === 0) throw new LastOwnerError()
}
