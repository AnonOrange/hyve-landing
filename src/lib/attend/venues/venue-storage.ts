// Upload an object to the attend-venue-assets bucket via the Supabase storage
// REST API with the service key. Mirrors the raw-REST posture of @/lib/supabase
// (no SDK — fetch with the service key). Writes are service-key only; the
// bucket is public-read so the browser viewer can fetch assets directly.
const BUCKET = 'attend-venue-assets'

export async function uploadVenueObject(
  path: string,
  body: ArrayBuffer,
  contentType: string,
): Promise<{ path: string }> {
  const key = process.env.SUPABASE_SERVICE_KEY!
  const url = `${process.env.SUPABASE_URL!}/storage/v1/object/${BUCKET}/${path}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body,
  })
  if (!res.ok) {
    throw new Error(`venue object upload failed: ${res.status} ${await res.text()}`)
  }
  return { path }
}

/** Public URL for a stored venue object (bucket is public-read). */
export function publicVenueUrl(path: string): string {
  return `${process.env.SUPABASE_URL!}/storage/v1/object/public/${BUCKET}/${path}`
}
