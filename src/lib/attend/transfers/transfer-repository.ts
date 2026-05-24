// Raw-REST data access for attend_ticket_transfers. Query-only — no business
// logic. Server-side only (service-key reads).
import { supaGet } from '@/lib/supabase'

// A transfer looked up for the claim page, with the ticket's event embedded
// so the recipient can see what they have been sent.
export interface TransferForClaim {
  id: string
  status: string
  expires_at: string
  method: string
  attend_tickets: {
    attend_events: { title: string; slug: string }
  }
}

export async function getTransferForClaim(by: {
  claimToken?: string
  friendCode?: string
}): Promise<TransferForClaim | null> {
  // encodeURIComponent: claimToken/friendCode are attacker-chosen + the claim
  // flow is anonymous. Unencoded, a value with '&' could inject extra PostgREST
  // params (widen the embedded select to leak buyer PII, drop guards, etc.).
  const filter = by.claimToken
    ? `claim_token=eq.${encodeURIComponent(by.claimToken)}`
    : by.friendCode
      ? `friend_code=eq.${encodeURIComponent(by.friendCode)}`
      : null
  if (!filter) return null

  const res = await supaGet(
    'attend_ticket_transfers',
    `${filter}&select=id,status,expires_at,method,attend_tickets(attend_events(title,slug))`,
  )
  if (!res.ok) throw new Error(`attend_ticket_transfers query failed: ${res.status}`)
  const rows = (await res.json()) as TransferForClaim[]
  return rows[0] ?? null
}
