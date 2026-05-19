// Raw-REST data access for attend_reaction_events. Query-only — no business logic.
import { supaPost } from '@/lib/supabase'

export interface NewReaction {
  event_id: string
  profile_id: string
  kind: string
}

export async function insertReaction(reaction: NewReaction): Promise<void> {
  const res = await supaPost('attend_reaction_events', reaction, 'return=minimal')
  if (!res.ok) {
    throw new Error(`attend_reaction_events insert failed: ${res.status} ${await res.text()}`)
  }
}
