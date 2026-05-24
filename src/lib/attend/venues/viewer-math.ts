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
