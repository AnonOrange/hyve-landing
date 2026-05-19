// HYVE Attend transfer expiry — sweeps PENDING ticket transfers past their
// expiry window via the atomic attend_expire_stale_transfers RPC, returning
// each lapsed ticket to its owner. Run on a schedule; idempotent.
import { supaPost } from '@/lib/supabase'

export async function expireStaleTransfers(): Promise<{ expired: number }> {
  const res = await supaPost('rpc/attend_expire_stale_transfers', { p_args: {} })
  if (!res.ok) {
    throw new Error(
      `attend_expire_stale_transfers RPC failed: ${res.status} ${await res.text()}`,
    )
  }
  return (await res.json()) as { expired: number }
}
