// Pure math for the venue viewer. Y-up, -Z forward — the same convention as
// the manifest world + the equirect click mapping (sub-plan #3), so the stage
// panel and the camera's initial aim agree with where the creator placed the
// stage. Kept dependency-free (no three) so it stays unit-testable.
const DEG = Math.PI / 180

/** Unit direction for a spherical (azimuth, elevation) in degrees. */
export function anglesToDirection(
  azimuthDeg: number,
  elevationDeg: number,
): { x: number; y: number; z: number } {
  const az = azimuthDeg * DEG
  const el = elevationDeg * DEG
  return {
    x: Math.sin(az) * Math.cos(el),
    y: Math.sin(el),
    z: -Math.cos(az) * Math.cos(el),
  }
}

/**
 * Size of the stage panel placed `radius` units from the camera, spanning
 * `hFovDeg` horizontally, at the given aspect (default 16:9 — the live video).
 */
export function stagePanelSize(
  hFovDeg: number,
  radius: number,
  aspect = 16 / 9,
): { width: number; height: number } {
  const width = 2 * radius * Math.tan((hFovDeg * DEG) / 2)
  return { width, height: width / aspect }
}

export interface AngularStage {
  azimuthDeg: number
  elevationDeg: number
  hFovDeg: number
}

/** Pull the angular stageScreen out of a stored manifest, or null. Shared by
 *  the venues page and the room so they extract it identically. */
export function angularStageFromManifest(
  manifest: Record<string, unknown> | null | undefined,
): AngularStage | null {
  const anchors = manifest?.anchors as Record<string, unknown> | undefined
  const ss = anchors?.stageScreen as Record<string, unknown> | undefined
  if (!ss || ss.kind !== 'angular') return null
  return {
    azimuthDeg: Number(ss.azimuthDeg) || 0,
    elevationDeg: Number(ss.elevationDeg) || 0,
    hFovDeg: Number(ss.hFovDeg) || 60,
  }
}

// A normalized, render-ready description of a venue scan. The viewer branches
// on `tier`: PANO_360 uses `stage` (angular); NAV_MESH uses `meshStage` (the
// stage node + dims) and `spawn`.
export interface VenueScan {
  tier: 'PANO_360' | 'NAV_MESH' | 'SPLAT'
  url: string
  /** SPLAT only: the parallel proxy .glb for anchors + navigation. */
  proxyUrl?: string
  stage?: AngularStage
  meshStage?: { node: string; widthM: number; heightM: number }
  spawn?: { positionM: [number, number, number]; yawDeg: number }
}

/** Normalize a stored manifest into a VenueScan. `toUrl` maps a storage path
 *  to its public URL (a splat also resolves its proxy mesh). Returns null if
 *  the manifest is incomplete for its tier. */
export function venueScanFromManifest(
  manifest: Record<string, unknown> | null | undefined,
  toUrl: (storagePath: string) => string,
): VenueScan | null {
  const tier = manifest?.tier
  const asset = manifest?.asset as { files?: string[]; splatProxy?: string | null } | undefined
  const primary = asset?.files?.[0]
  if (!primary) return null
  const url = toUrl(primary)
  const anchors = manifest?.anchors as Record<string, unknown> | undefined
  const ss = anchors?.stageScreen as Record<string, unknown> | undefined

  if (tier === 'PANO_360') {
    const stage = angularStageFromManifest(manifest)
    return stage ? { tier, url, stage } : null
  }

  if ((tier === 'NAV_MESH' || tier === 'SPLAT') && ss && ss.kind === 'rect') {
    if (tier === 'SPLAT' && !asset?.splatProxy) return null
    const spawnRaw = anchors?.spawn as Record<string, unknown> | undefined
    const pos = Array.isArray(spawnRaw?.positionM) ? (spawnRaw!.positionM as number[]) : [0, 1.6, 8]
    return {
      tier,
      url,
      proxyUrl: tier === 'SPLAT' ? toUrl(asset!.splatProxy as string) : undefined,
      meshStage: {
        node: String(ss.node ?? 'ANCHOR_stage_screen'),
        widthM: Number(ss.widthM) || 8,
        heightM: Number(ss.heightM) || 4.5,
      },
      spawn: {
        positionM: [Number(pos[0]) || 0, Number(pos[1]) || 1.6, Number(pos[2]) || 8],
        yawDeg: Number(spawnRaw?.yawDeg) || 0,
      },
    }
  }
  return null
}
