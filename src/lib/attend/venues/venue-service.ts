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
} from '@/lib/attend/venues/venue-repository'
import { slugifyTitle, uniqueSlug } from '@/lib/attend/events/slug'
import { ValidationError } from '@/lib/attend/events/service'

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
  if (!input.file.contentType.startsWith('image/')) {
    throw new ValidationError('Pano must be an image (equirectangular JPEG/PNG)')
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
