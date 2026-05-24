# Venue Tier-1 Self-Serve Upload Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a creator create a venue, upload a 360° pano, place the stage screen on the flat equirectangular image, and persist a validated Tier-1 venue scan — all without a 3D library.

**Architecture:** A pure `equirectClickToAngles()` converts a click on the flat 2:1 pano to spherical angles for the manifest's `angular` `stageScreen`. A service-key storage helper uploads the pano to the `attend-venue-assets` bucket. Two creator-gated API routes (create venue; upload asset) sit over `venue-service`. The creator UI is a normal client form — no Three.js (immersive preview is sub-plan #4).

**Tech Stack:** Next.js route handlers (formData), TypeScript, Vitest. Depends on sub-plans #1 (manifest lib) + #2 (data model + `persistVenueAsset`).

**Spec:** `docs/superpowers/specs/2026-05-24-venue-3d-scan-requirements-design.md`

---

## File Structure

- Create: `src/lib/attend/venues/equirect.ts` — pure `equirectClickToAngles()`.
- Create: `src/lib/attend/venues/equirect.test.ts` — Vitest.
- Create: `src/lib/attend/venues/venue-storage.ts` — `uploadVenueObject()` (storage REST, service key).
- Modify: `src/lib/attend/venues/venue-repository.ts` — add `listVenuesManagedBy()`.
- Modify: `src/lib/attend/venues/venue-service.ts` — add `createCreatorVenue()` + `uploadVenuePanoAsset()`.
- Create: `src/app/api/attend/venues/route.ts` — `POST` create venue.
- Create: `src/app/api/attend/venues/[id]/assets/route.ts` — `POST` upload pano asset (formData).
- Create: `src/app/attend/(creator)/creator/venues/page.tsx` — server page (requireCreator + list).
- Create: `src/app/attend/(creator)/creator/venues/venues-client.tsx` — create/upload/placement form.

---

## Chunk 1: Pure mapping + storage + service + routes + UI

### Task 1: equirectClickToAngles (pure)

**Convention (documented in code):** image width → 360° azimuth, height → 180° elevation. Center of image = forward (`azimuth 0`, `elevation 0`); top = `+90°`, bottom = `-90°`. Azimuth range `[-180, 180)`. Clicks are clamped into bounds.

**Files:** Create `src/lib/attend/venues/equirect.ts`, `src/lib/attend/venues/equirect.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest'
import { equirectClickToAngles } from '@/lib/attend/venues/equirect'

describe('equirectClickToAngles', () => {
  it('maps image centre to forward + horizon', () => {
    expect(equirectClickToAngles(1000, 500, 2000, 1000)).toEqual({ azimuthDeg: 0, elevationDeg: 0 })
  })
  it('maps left edge to -180 azimuth, top to +90 elevation', () => {
    expect(equirectClickToAngles(0, 0, 2000, 1000)).toEqual({ azimuthDeg: -180, elevationDeg: 90 })
  })
  it('maps bottom to -90 elevation', () => {
    expect(equirectClickToAngles(1000, 1000, 2000, 1000)).toEqual({ azimuthDeg: 0, elevationDeg: -90 })
  })
  it('clamps out-of-bounds clicks', () => {
    const r = equirectClickToAngles(-50, 5000, 2000, 1000)
    expect(r.azimuthDeg).toBe(-180)
    expect(r.elevationDeg).toBe(-90)
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/lib/attend/venues/equirect.test.ts` → FAIL.

- [ ] **Step 3: Implement**

```typescript
// Pure: convert a click on a flat 2:1 equirectangular pano to spherical
// angles for the manifest's angular stageScreen anchor.
// Convention: width -> 360° azimuth, height -> 180° elevation. Image centre
// = forward (0,0); top = +90°, bottom = -90°; azimuth in [-180, 180).
export function equirectClickToAngles(
  x: number, y: number, width: number, height: number,
): { azimuthDeg: number; elevationDeg: number } {
  const cx = Math.min(Math.max(x, 0), width)
  const cy = Math.min(Math.max(y, 0), height)
  return {
    azimuthDeg: (cx / width) * 360 - 180,
    elevationDeg: 90 - (cy / height) * 180,
  }
}
```

- [ ] **Step 4: Run to verify pass** — PASS (4).
- [ ] **Step 5: Commit** — `git commit -m "feat(attend): pure equirect click->angles mapping"`

---

### Task 2: Storage upload helper

**Files:** Create `src/lib/attend/venues/venue-storage.ts`

Thin I/O over Supabase storage REST with the service key; verified by typecheck + integration later.

- [ ] **Step 1: Implement**

```typescript
// Upload an object to the attend-venue-assets bucket via the storage REST
// API with the service key. Mirrors the raw-REST posture of @/lib/supabase.
const BUCKET = 'attend-venue-assets'

export async function uploadVenueObject(
  path: string, body: ArrayBuffer, contentType: string,
): Promise<{ path: string }> {
  const key = process.env.SUPABASE_SERVICE_KEY!
  const url = `${process.env.SUPABASE_URL!}/storage/v1/object/${BUCKET}/${path}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': contentType, 'x-upsert': 'true' },
    body,
  })
  if (!res.ok) throw new Error(`venue object upload failed: ${res.status} ${await res.text()}`)
  return { path }
}

export function publicVenueUrl(path: string): string {
  return `${process.env.SUPABASE_URL!}/storage/v1/object/public/${BUCKET}/${path}`
}
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit`.
- [ ] **Step 3: Commit** — `git commit -m "feat(attend): venue storage upload helper"`

---

### Task 3: Repository + service additions

**Files:** Modify `src/lib/attend/venues/venue-repository.ts`, `src/lib/attend/venues/venue-service.ts`

- [ ] **Step 1: Repository — add `listVenuesManagedBy`**

```typescript
export async function listVenuesManagedBy(profileId: string): Promise<VenueRow[]> {
  const res = await supaGet('attend_venues',
    `managed_by=eq.${encodeURIComponent(profileId)}&deleted_at=is.null&order=created_at.desc&select=id,slug,name,managed_by`)
  if (!res.ok) throw new Error(`listVenuesManagedBy failed: ${res.status} ${await res.text()}`)
  return (await res.json()) as VenueRow[]
}

export async function listVenueSlugs(): Promise<string[]> {
  const res = await supaGet('attend_venues', `select=slug`)
  if (!res.ok) throw new Error(`listVenueSlugs failed: ${res.status} ${await res.text()}`)
  return ((await res.json()) as { slug: string }[]).map((r) => r.slug)
}
```

- [ ] **Step 2: Service — add `createCreatorVenue` + `uploadVenuePanoAsset`**

```typescript
import { slugifyTitle, uniqueSlug } from '@/lib/attend/events/slug'
import { insertVenue, listVenueSlugs } from '@/lib/attend/venues/venue-repository'
import { uploadVenueObject } from '@/lib/attend/venues/venue-storage'
import { buildPano360Manifest } from '@/lib/attend/venues/manifest-builder'
import { ValidationError } from '@/lib/attend/events/service'

export async function createCreatorVenue(input: {
  name: string; city?: string; country?: string; actor: string
}) {
  const name = input.name?.trim()
  if (!name) throw new ValidationError('Venue name is required')
  const slug = uniqueSlug(slugifyTitle(name), await listVenueSlugs())
  return insertVenue({ slug, name, city: input.city, country: input.country, managedBy: input.actor, actor: input.actor })
}

export async function uploadVenuePanoAsset(input: {
  venueId: string; actor: string
  file: { bytes: ArrayBuffer; contentType: string; ext: string }
  stageAzimuthDeg: number; stageElevationDeg: number; stageHFovDeg: number
  scaleDescription: string; scaleMeters: number
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
    method: 'self-serve-upload', operator: 'venue',
    ownerWarrantsRights: true, brandingCleared: true,
  })
  return persistVenueAsset({ venueId: input.venueId, tier: 'PANO_360', manifest, storagePath: path, actor: input.actor })
}
```

- [ ] **Step 3: Typecheck + commit** — `git commit -m "feat(attend): createCreatorVenue + uploadVenuePanoAsset"`

---

### Task 4: API routes

**Files:** Create `src/app/api/attend/venues/route.ts`, `src/app/api/attend/venues/[id]/assets/route.ts`

- [ ] **Step 1: POST /api/attend/venues** — requireCreator → `createCreatorVenue` → 200 `{ id, slug }` / map ValidationError→400, 401 if no profile.

- [ ] **Step 2: POST /api/attend/venues/[id]/assets** — requireCreator; read `formData()`: `file` (Blob) + numeric fields (`azimuthDeg`,`elevationDeg`,`hFovDeg`,`scaleMeters`) + `scaleDescription`; convert file via `await file.arrayBuffer()`; derive ext from MIME; call `uploadVenuePanoAsset`; return `{ id, status, validation }`. `export const runtime = 'nodejs'`.

```typescript
// src/app/api/attend/venues/[id]/assets/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireCreator } from '@/lib/attend/identity/roles'
import { uploadVenuePanoAsset } from '@/lib/attend/venues/venue-service'
import { ValidationError } from '@/lib/attend/events/service'

export const runtime = 'nodejs'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const profile = await requireCreator()
  if (!profile) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No pano file' }, { status: 400 })
    const ext = file.type === 'image/png' ? 'png' : 'jpg'
    const result = await uploadVenuePanoAsset({
      venueId: params.id, actor: profile.id,
      file: { bytes: await file.arrayBuffer(), contentType: file.type || 'image/jpeg', ext },
      stageAzimuthDeg: Number(form.get('azimuthDeg')),
      stageElevationDeg: Number(form.get('elevationDeg')),
      stageHFovDeg: Number(form.get('hFovDeg')),
      scaleDescription: String(form.get('scaleDescription') ?? 'reference'),
      scaleMeters: Number(form.get('scaleMeters')),
    })
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 })
    console.error('[attend venue asset]:', (err as Error).message)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Typecheck + commit** — `git commit -m "feat(attend): venue create + asset upload API routes"`

---

### Task 5: Creator venues UI

**Files:** Create `src/app/attend/(creator)/creator/venues/page.tsx`, `venues-client.tsx`

- [ ] **Step 1: Server page** — `requireCreator`/redirect; `listVenuesManagedBy(profile.id)`; `PageHero` (bg-8, eyebrow "Venues", title "Your venues"); render `<VenuesClient venues={...} />`. `export const dynamic = 'force-dynamic'`.

- [ ] **Step 2: Client form** — create-venue input → POST /api/attend/venues → reload. Per venue: file input (pano) → object URL shown as a 2:1 `<img>`; click handler maps `offsetX/offsetY` via `equirectClickToAngles` (using the rendered img dimensions) → store angles + draw a marker; FOV `<input type=range min=20 max=120>`; scale description + metres inputs; submit builds `FormData`, POSTs to `/assets`, shows `status` + any `validation.warnings`/`errors`.

- [ ] **Step 3: Typecheck + commit** — `git commit -m "feat(attend): creator venues page + Tier-1 upload UI"`

---

### Task 6: Full-suite gate + ship

- [ ] **Step 1:** `npx tsc --noEmit` → clean.
- [ ] **Step 2:** `npx vitest run` → all pass (prior 110 + 4 equirect).
- [ ] **Step 3:** commit any remainder; push; watch Vercel deploy; verify `/attend/creator/venues` renders.

---

## Follow-on plans
4. Tier-1 browser viewer (Three.js textured sphere mounting Mux video on `stageScreen`) — first heavyweight client dep; decide deliberately.
5. CSP origin for the bucket + event↔venue linkage.

## Remember
- DRY, YAGNI, TDD, frequent commits. No 3D dependency in this plan.
- Routes are creator-gated (`requireCreator`); service throws `ValidationError`→400.
- The pano placement uses the FLAT equirect image — the sphere preview is sub-plan #4.
