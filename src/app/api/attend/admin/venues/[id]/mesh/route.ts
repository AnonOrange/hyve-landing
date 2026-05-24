import { NextRequest, NextResponse } from 'next/server'
import { requireReviewer } from '@/lib/attend/identity/roles'
import { uploadVenueMeshAsset } from '@/lib/attend/venues/venue-service'
import { ValidationError } from '@/lib/attend/events/service'
import { writeAuditLog } from '@/lib/attend/audit/audit-log'

export const runtime = 'nodejs'

// POST /api/attend/admin/venues/[id]/mesh — upload a contracted Tier-2 .glb +
// its placement. ADMIN/REVIEWER only (venues can't self-produce meshes).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const reviewer = await requireReviewer()
  if (!reviewer) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No .glb file provided' }, { status: 400 })

    const result = await uploadVenueMeshAsset({
      venueId: params.id,
      actor: reviewer.id,
      file: { bytes: await file.arrayBuffer(), contentType: file.type || 'model/gltf-binary' },
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
      action: 'venue.mesh_upload',
      entityType: 'VENUE',
      entityId: params.id,
    })
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 })
    console.error('[attend venue mesh]:', (err as Error).message)
    return NextResponse.json({ error: 'Mesh upload failed' }, { status: 500 })
  }
}
