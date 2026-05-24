import { NextRequest, NextResponse } from 'next/server'
import { requireReviewer } from '@/lib/attend/identity/roles'
import { uploadVenueSplatAsset } from '@/lib/attend/venues/venue-service'
import { ValidationError } from '@/lib/attend/events/service'
import { writeAuditLog } from '@/lib/attend/audit/audit-log'

export const runtime = 'nodejs'

// POST /api/attend/admin/venues/[id]/splat — upload a Tier-3 Gaussian splat
// (.ksplat/.ply/.splat) + its parallel proxy .glb + placement. Reviewer only.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const reviewer = await requireReviewer()
  if (!reviewer) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  try {
    const form = await req.formData()
    const splat = form.get('splat') as File | null
    const proxy = form.get('proxy') as File | null
    if (!splat) return NextResponse.json({ error: 'No splat file provided' }, { status: 400 })
    if (!proxy) return NextResponse.json({ error: 'A proxy .glb is required for splats' }, { status: 400 })

    const ext = (splat.name.split('.').pop() ?? 'ksplat').toLowerCase()
    const result = await uploadVenueSplatAsset({
      venueId: params.id,
      actor: reviewer.id,
      splat: { bytes: await splat.arrayBuffer(), contentType: splat.type, ext },
      proxy: { bytes: await proxy.arrayBuffer(), contentType: proxy.type || 'model/gltf-binary' },
      stageNode: String(form.get('stageNode') ?? 'ANCHOR_stage_screen'),
      stageWidthM: Number(form.get('stageWidthM')) || 8,
      stageHeightM: Number(form.get('stageHeightM')) || 4.5,
      spawnPositionM: [
        Number(form.get('spawnX')) || 0,
        Number(form.get('spawnY')) || 1.6,
        Number(form.get('spawnZ')) || 8,
      ],
      spawnYawDeg: Number(form.get('spawnYawDeg')) || 0,
      scaleDescription: String(form.get('scaleDescription') ?? 'reference'),
      scaleMeters: Number(form.get('scaleMeters')) || 2.03,
    })
    await writeAuditLog({
      actorId: reviewer.id,
      action: 'venue.splat_upload',
      entityType: 'VENUE',
      entityId: params.id,
    })
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 })
    console.error('[attend venue splat]:', (err as Error).message)
    return NextResponse.json({ error: 'Splat upload failed' }, { status: 500 })
  }
}
