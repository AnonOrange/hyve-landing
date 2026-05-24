// Pure: convert a click on a flat 2:1 equirectangular pano to spherical
// angles for the manifest's angular stageScreen anchor.
//
// Convention: width -> 360° azimuth, height -> 180° elevation. Image centre
// = forward (0,0); top edge = +90° (up), bottom = -90° (down); azimuth in
// [-180, 180). Centre-forward aligns with buildPano360Manifest's default
// spawn.yawDeg, so a click dead-centre puts the stage straight ahead of the
// default viewpoint. Out-of-bounds clicks are clamped into the image.
export function equirectClickToAngles(
  x: number,
  y: number,
  width: number,
  height: number,
): { azimuthDeg: number; elevationDeg: number } {
  const cx = Math.min(Math.max(x, 0), width)
  const cy = Math.min(Math.max(y, 0), height)
  return {
    azimuthDeg: (cx / width) * 360 - 180,
    elevationDeg: 90 - (cy / height) * 180,
  }
}
