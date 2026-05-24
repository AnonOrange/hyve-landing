// Venue scan persistence + the Tier-1 self-serve flow: create a venue, upload
// a pano, and store a validated scan. Orchestration over the pure validator +
// record builder + manifest builder + storage + repo.
import type { VenueManifest, VenueTier } from '@/lib/attend/venues/manifest-types'
import { validateManifest } from '@/lib/attend/venues/manifest-validator'
import { buildVenueAssetRecord } from '@/lib/attend/venues/venue-record'
import {
  buildPano360Manifest,
  buildNavMeshManifest,
  buildSplatManifest,
} from '@/lib/attend/venues/manifest-builder'
import { uploadVenueObject } from '@/lib/attend/venues/venue-storage'
import {
  insertVenue,
  insertVenueAsset,
  listVenueSlugs,
  getVenueById,
} from '@/lib/attend/venues/venue-repository'
import { slugifyTitle, uniqueSlug } from '@/lib/attend/events/slug'
import { ValidationError, ForbiddenError, NotFoundError } from '@/lib/attend/events/service'

// Per-tier upload size caps (bytes). Routes reject on file.size BEFORE reading
// the body into memory (the real DoS guard); the service re-checks byteLength
// as a backstop. An unbounded upload is a memory + storage-cost DoS.
export const MAX_PANO_BYTES = 30 * 1024 * 1024 // 360° equirect (spec ≤25 MB)
export const MAX_MESH_BYTES = 80 * 1024 * 1024 // optimized .glb
export const MAX_SPLAT_BYTES = 350 * 1024 * 1024 // Gaussian splat

// Magic-byte sniff so a non-image can't be stored as a "pano" by spoofing the
// client Content-Type. Covers JPEG / PNG / WebP (RIFF....WEBP).
function looksLikeImage(bytes: ArrayBuffer): boolean {
  const b = new Uint8Array(bytes.slice(0, 12))
  const jpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
  const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
  const webp =
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  return jpeg || png || webp
}

/**
 * Validate a manifest and persist the resulting asset row. Returns the new id,
 * the stored status, and the validation result so the caller (the upload API)
 * can surface errors/warnings. A REJECTED asset is still stored — it's the
 * audit trail of what a venue submitted and why it failed.
 */
export async function persistVenueAsset(input: {
  venueId: string
  tier: VenueTier
  manifest: VenueManifest
  storagePath: string
  actor: string
}) {
  const validation = validateManifest(input.manifest)
  const record = buildVenueAssetRecord({ ...input, validation })
  const { id } = await insertVenueAsset(record)
  return { id, status: record.status, validation }
}

/** Create a venue managed by the calling creator. Slug is derived + de-duped. */
export async function createCreatorVenue(input: {
  name: string
  city?: string
  country?: string
  actor: string
}) {
  const name = input.name?.trim()
  if (!name) throw new ValidationError('Venue name is required')
  const slug = uniqueSlug(slugifyTitle(name), await listVenueSlugs())
  return insertVenue({
    slug,
    name,
    city: input.city,
    country: input.country,
    managedBy: input.actor,
    actor: input.actor,
  })
}

/**
 * Tier-1 self-serve: upload a 360 pano to the bucket, build its manifest from
 * the creator's stage-screen placement, then validate + persist. Returns the
 * asset id, stored status, and validation (so the UI can surface warnings).
 */
export async function uploadVenuePanoAsset(input: {
  venueId: string
  actor: string
  file: { bytes: ArrayBuffer; contentType: string; ext: string }
  stageAzimuthDeg: number
  stageElevationDeg: number
  stageHFovDeg: number
  scaleDescription: string
  scaleMeters: number
}) {
  // AUTHORIZATION: the caller must manage this venue. Without this, any creator
  // could write a scan into any venue by id (IDOR) and hijack its 3D room.
  const venue = await getVenueById(input.venueId)
  if (!venue) throw new NotFoundError('Venue not found')
  if (venue.managed_by !== input.actor) throw new ForbiddenError('This is not your venue')

  if (input.file.bytes.byteLength > MAX_PANO_BYTES) {
    throw new ValidationError('Pano is too large (max 30 MB)')
  }
  if (!input.file.contentType.startsWith('image/') || !looksLikeImage(input.file.bytes)) {
    throw new ValidationError('Pano must be an image (equirectangular JPEG/PNG/WebP)')
  }
  const path = `${input.venueId}/${Date.now()}.${input.file.ext}`
  await uploadVenueObject(path, input.file.bytes, input.file.contentType)
  const manifest = buildPano360Manifest({
    file: path,
    stageAzimuthDeg: input.stageAzimuthDeg,
    stageElevationDeg: input.stageElevationDeg,
    stageHFovDeg: input.stageHFovDeg,
    scaleReference: { description: input.scaleDescription, realMeters: input.scaleMeters },
    capturedAt: new Date().toISOString().slice(0, 10),
    method: 'self-serve-upload',
    operator: 'venue',
    ownerWarrantsRights: true,
    brandingCleared: true,
  })
  return persistVenueAsset({
    venueId: input.venueId,
    tier: 'PANO_360',
    manifest,
    storagePath: path,
    actor: input.actor,
  })
}

/**
 * Tier-2 contracted intake (reviewer-only): upload an optimized .glb to the
 * bucket, build its NAV_MESH manifest, validate + persist. Venues can't
 * self-produce these, so this runs from the admin area.
 */
export async function uploadVenueMeshAsset(input: {
  venueId: string
  actor: string
  file: { bytes: ArrayBuffer; contentType: string }
  stageNode: string
  stageWidthM: number
  stageHeightM: number
  spawnPositionM: [number, number, number]
  spawnYawDeg: number
  scaleDescription: string
  scaleMeters: number
}) {
  // Reviewer-invoked (any venue), but the venue must exist — else we'd write an
  // orphan storage object whose DB insert then fails on the FK.
  if (!(await getVenueById(input.venueId))) throw new NotFoundError('Venue not found')
  if (input.file.bytes.byteLength > MAX_MESH_BYTES) {
    throw new ValidationError('Mesh is too large (max 80 MB)')
  }
  const path = `${input.venueId}/mesh-${Date.now()}.glb`
  await uploadVenueObject(path, input.file.bytes, input.file.contentType || 'model/gltf-binary')
  const manifest = buildNavMeshManifest({
    file: path,
    stageNode: input.stageNode || 'ANCHOR_stage_screen',
    stageWidthM: input.stageWidthM,
    stageHeightM: input.stageHeightM,
    spawnPositionM: input.spawnPositionM,
    spawnYawDeg: input.spawnYawDeg,
    scaleReference: { description: input.scaleDescription, realMeters: input.scaleMeters },
    capturedAt: new Date().toISOString().slice(0, 10),
    method: 'hyve-contracted',
    operator: 'hyve-contracted',
    ownerWarrantsRights: true,
    brandingCleared: true,
  })
  return persistVenueAsset({
    venueId: input.venueId,
    tier: 'NAV_MESH',
    manifest,
    storagePath: path,
    actor: input.actor,
  })
}

/**
 * Tier-3 contracted intake (reviewer-only): a Gaussian splat + its parallel
 * proxy .glb (the proxy supplies anchors/navigation since splats have no
 * surfaces). Stores both, builds the SPLAT manifest, validates + persists.
 */
export async function uploadVenueSplatAsset(input: {
  venueId: string
  actor: string
  splat: { bytes: ArrayBuffer; contentType: string; ext: string }
  proxy: { bytes: ArrayBuffer; contentType: string }
  stageNode: string
  stageWidthM: number
  stageHeightM: number
  spawnPositionM: [number, number, number]
  spawnYawDeg: number
  scaleDescription: string
  scaleMeters: number
}) {
  if (!(await getVenueById(input.venueId))) throw new NotFoundError('Venue not found')
  if (input.splat.bytes.byteLength > MAX_SPLAT_BYTES) {
    throw new ValidationError('Splat is too large (max 350 MB)')
  }
  if (input.proxy.bytes.byteLength > MAX_MESH_BYTES) {
    throw new ValidationError('Proxy mesh is too large (max 80 MB)')
  }
  const stamp = Date.now()
  const splatExt = ['ksplat', 'ply', 'splat'].includes(input.splat.ext) ? input.splat.ext : 'ksplat'
  const splatPath = `${input.venueId}/splat-${stamp}.${splatExt}`
  const proxyPath = `${input.venueId}/splat-proxy-${stamp}.glb`
  await uploadVenueObject(splatPath, input.splat.bytes, input.splat.contentType || 'application/octet-stream')
  await uploadVenueObject(proxyPath, input.proxy.bytes, input.proxy.contentType || 'model/gltf-binary')
  const manifest = buildSplatManifest({
    file: splatPath,
    proxyFile: proxyPath,
    stageNode: input.stageNode || 'ANCHOR_stage_screen',
    stageWidthM: input.stageWidthM,
    stageHeightM: input.stageHeightM,
    spawnPositionM: input.spawnPositionM,
    spawnYawDeg: input.spawnYawDeg,
    scaleReference: { description: input.scaleDescription, realMeters: input.scaleMeters },
    capturedAt: new Date().toISOString().slice(0, 10),
    method: 'hyve-contracted',
    operator: 'hyve-contracted',
    ownerWarrantsRights: true,
    brandingCleared: true,
  })
  return persistVenueAsset({
    venueId: input.venueId,
    tier: 'SPLAT',
    manifest,
    storagePath: splatPath,
    actor: input.actor,
  })
}
