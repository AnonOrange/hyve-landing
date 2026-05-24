// HYVE Attend — site sponsors. Admin-managed sponsor credits shown in the
// footer. Raw-REST via the shared Supabase helpers (service-key access). The
// is_active on/off switch is enforced here in the query layer (Attend reads
// with the service key, so it can't rely on an anon RLS policy the way
// HyveNews does).
import { supaGet, supaPost, supaPatch } from '@/lib/supabase'
import { ValidationError } from '@/lib/attend/events/service'

export type SponsorTier = 'PLATINUM' | 'GOLD' | 'SILVER' | 'COMMUNITY'
const TIERS: SponsorTier[] = ['PLATINUM', 'GOLD', 'SILVER', 'COMMUNITY']

export interface SponsorRow {
  id: string
  name: string
  url: string
  logo_url: string | null
  tier: SponsorTier
  blurb: string | null
  is_active: boolean
  sort_order: number
}

const SELECT = 'id,name,url,logo_url,tier,blurb,is_active,sort_order'

/** Public footer read — only active, non-deleted sponsors. */
export async function listActiveSponsors(): Promise<SponsorRow[]> {
  const res = await supaGet(
    'attend_sponsors',
    `is_active=eq.true&deleted_at=is.null&order=sort_order.asc,created_at.asc&select=${SELECT}`,
  )
  if (!res.ok) throw new Error(`listActiveSponsors failed: ${res.status} ${await res.text()}`)
  return (await res.json()) as SponsorRow[]
}

/** Admin read — every non-deleted sponsor, active or not. */
export async function listAllSponsors(): Promise<SponsorRow[]> {
  const res = await supaGet(
    'attend_sponsors',
    `deleted_at=is.null&order=is_active.desc,sort_order.asc,created_at.asc&select=${SELECT}`,
  )
  if (!res.ok) throw new Error(`listAllSponsors failed: ${res.status} ${await res.text()}`)
  return (await res.json()) as SponsorRow[]
}

export async function createSponsor(input: {
  name: string
  url: string
  logoUrl?: string
  tier?: string
  blurb?: string
  sortOrder?: number
  actor: string
}): Promise<SponsorRow> {
  const name = input.name?.trim()
  const url = input.url?.trim()
  if (!name) throw new ValidationError('Sponsor name is required')
  if (!url || !/^https?:\/\//i.test(url)) {
    throw new ValidationError('Sponsor URL must start with http:// or https://')
  }
  const tier = (input.tier ?? 'COMMUNITY').toUpperCase() as SponsorTier
  if (!TIERS.includes(tier)) throw new ValidationError('Invalid sponsor tier')

  const res = await supaPost('attend_sponsors', {
    name,
    url,
    logo_url: input.logoUrl?.trim() || null,
    tier,
    blurb: input.blurb?.trim() || null,
    sort_order: input.sortOrder ?? 0,
    created_by: input.actor,
  })
  if (!res.ok) throw new Error(`createSponsor failed: ${res.status} ${await res.text()}`)
  return ((await res.json()) as SponsorRow[])[0]
}

export async function setSponsorActive(id: string, isActive: boolean, actor: string): Promise<void> {
  const res = await supaPatch('attend_sponsors', `id=eq.${encodeURIComponent(id)}`, {
    is_active: isActive,
    updated_at: new Date().toISOString(),
    updated_by: actor,
  })
  if (!res.ok) throw new Error(`setSponsorActive failed: ${res.status} ${await res.text()}`)
}

/** Soft delete — keeps the row, removes it from every read. */
export async function deleteSponsor(id: string, actor: string): Promise<void> {
  const res = await supaPatch('attend_sponsors', `id=eq.${encodeURIComponent(id)}`, {
    deleted_at: new Date().toISOString(),
    is_active: false,
    updated_by: actor,
  })
  if (!res.ok) throw new Error(`deleteSponsor failed: ${res.status} ${await res.text()}`)
}
