import { NextRequest, NextResponse } from 'next/server'
import { requireReviewer } from '@/lib/attend/identity/roles'
import { createSponsor } from '@/lib/attend/sponsors/sponsor-service'
import { ValidationError } from '@/lib/attend/events/service'
import { writeAuditLog } from '@/lib/attend/audit/audit-log'

export const runtime = 'nodejs'

// POST /api/attend/admin/sponsors — add a sponsor. ADMIN/REVIEWER only.
export async function POST(req: NextRequest) {
  const reviewer = await requireReviewer()
  if (!reviewer) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  try {
    const body = (await req.json().catch(() => ({}))) as {
      name?: string
      url?: string
      logoUrl?: string
      tier?: string
      blurb?: string
    }
    const sponsor = await createSponsor({
      name: body.name ?? '',
      url: body.url ?? '',
      logoUrl: body.logoUrl,
      tier: body.tier,
      blurb: body.blurb,
      actor: reviewer.id,
    })
    await writeAuditLog({
      actorId: reviewer.id,
      action: 'sponsor.create',
      entityType: 'SPONSOR',
      entityId: sponsor.id,
    })
    return NextResponse.json({ ok: true, id: sponsor.id })
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[attend sponsor create]:', (err as Error).message)
    return NextResponse.json({ error: 'Failed to add sponsor' }, { status: 500 })
  }
}
