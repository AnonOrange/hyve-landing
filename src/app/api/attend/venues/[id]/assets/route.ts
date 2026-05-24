import { NextRequest, NextResponse } from 'next/server'
import { requireCreator } from '@/lib/attend/identity/roles'
import { uploadVenuePanoAsset } from '@/lib/attend/venues/venue-service'
import { ValidationError } from '@/lib/attend/events/service'

export const runtime = 'nodejs'

// POST /api/attend/venues/[id]/assets — upload a Tier-1 360 pano + the
// creator's stage-screen placement. Multipart form-data: `file` plus the
// numeric placement fields. Returns { id, status, validation }.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const profile = await requireCreator()
  if (!profile) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No pano file provided' }, { status: 400 })

    const ext = file.type === 'image/png' ? 'png' : 'jpg'
    const result = await uploadVenuePanoAsset({
      venueId: params.id,
      actor: profile.id,
      file: { bytes: await file.arrayBuffer(), contentType: file.type || 'image/jpeg', ext },
      stageAzimuthDeg: Number(form.get('azimuthDeg')),
      stageElevationDeg: Number(form.get('elevationDeg')),
      stageHFovDeg: Number(form.get('hFovDeg')),
      scaleDescription: String(form.get('scaleDescription') ?? 'reference'),
      scaleMeters: Number(form.get('scaleMeters')),
    })
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[attend venue asset]:', (err as Error).message)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
