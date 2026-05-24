# Venue Tier-1 Browser Viewer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render an uploaded Tier-1 (360°) venue scan in the browser — an equirectangular sphere you can look around, with the stage screen marked at the placement chosen in sub-plan #3. Previewable from the creator venues page.

**Architecture:** Three.js (dynamic-imported, `ssr:false`, code-split). A pure `viewer-math` module converts the manifest's `angular` stageScreen to a 3D direction + panel size — shared by both the panel placement and the camera's initial aim so they always agree. The viewer is a self-contained client component; the venues page lazy-loads it per venue that has a VALIDATED pano. Live Mux video on the panel is the sub-plan #5 seam (the `videoUrl` prop).

**Tech Stack:** Three.js, TypeScript, Vitest. Depends on sub-plans #1–#3.

**Spec:** `docs/superpowers/specs/2026-05-24-venue-3d-scan-requirements-design.md`

---

## File Structure

- Add dep: `three` + `@types/three`.
- Create: `src/lib/attend/venues/viewer-math.ts` — pure `anglesToDirection()` + `stagePanelSize()`.
- Create: `src/lib/attend/venues/viewer-math.test.ts` — Vitest.
- Create: `src/app/attend/_components/venue-viewer.tsx` — Three.js client component.
- Modify: `src/lib/attend/venues/venue-repository.ts` — add `getVenueActivePano()`.
- Modify: `src/app/attend/(creator)/creator/venues/page.tsx` — fetch each venue's active pano, pass down.
- Modify: `src/app/attend/(creator)/creator/venues/venues-client.tsx` — lazy "Preview in 3D" per venue with a pano.

---

## Chunk 1: Viewer

### Task 1: Add Three.js
- [ ] `npm install three && npm install -D @types/three`
- [ ] `npx tsc --noEmit` clean; commit `package.json` + lockfile: `chore: add three for the venue viewer`.

### Task 2: Pure viewer math

**Convention:** Y-up, −Z forward (matches manifest `world`). `anglesToDirection(az,el)` = `(sin az·cos el, sin el, −cos az·cos el)`. `stagePanelSize(hFovDeg, radius, aspect=16/9)`: `width = 2·radius·tan(hFov/2)`, `height = width/aspect`.

**Files:** Create `viewer-math.ts`, `viewer-math.test.ts`

- [ ] **Step 1: failing test**

```typescript
import { describe, it, expect } from 'vitest'
import { anglesToDirection, stagePanelSize } from '@/lib/attend/venues/viewer-math'

const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 5)

describe('anglesToDirection', () => {
  it('centre faces -Z (forward)', () => {
    const d = anglesToDirection(0, 0); near(d.x, 0); near(d.y, 0); near(d.z, -1)
  })
  it('+90 azimuth faces +X', () => {
    const d = anglesToDirection(90, 0); near(d.x, 1); near(d.y, 0); near(d.z, 0)
  })
  it('+90 elevation faces +Y (up)', () => {
    const d = anglesToDirection(0, 90); near(d.x, 0); near(d.y, 1); near(d.z, 0)
  })
  it('180 azimuth faces +Z (behind)', () => {
    const d = anglesToDirection(180, 0); near(d.z, 1)
  })
})

describe('stagePanelSize', () => {
  it('90° hFov at radius 10 → width 20, 16:9 height', () => {
    const s = stagePanelSize(90, 10); near(s.width, 20); near(s.height, 20 / (16 / 9))
  })
})
```

- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: implement**

```typescript
// Pure math for the venue viewer. Y-up, -Z forward — the same convention as
// the manifest world + the equirect click mapping (sub-plan #3), so the stage
// panel and the camera's aim agree with where the creator placed the stage.
const DEG = Math.PI / 180

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

export function stagePanelSize(
  hFovDeg: number,
  radius: number,
  aspect = 16 / 9,
): { width: number; height: number } {
  const width = 2 * radius * Math.tan((hFovDeg * DEG) / 2)
  return { width, height: width / aspect }
}
```

- [ ] **Step 4:** run → PASS (5).
- [ ] **Step 5:** commit `feat(attend): pure venue-viewer math`.

### Task 3: VenueViewer component

**Files:** Create `src/app/attend/_components/venue-viewer.tsx`

Three.js glue (not unit-tested — needs WebGL; verified by build + visual smoke test).

- [ ] **Step 1: implement** — `'use client'`. In a `useEffect`:
  - `WebGLRenderer` sized to the mount; `PerspectiveCamera(75, …)` at origin.
  - Inverted `SphereGeometry(50,64,40)` (`geo.scale(-1,1,1)`), `MeshBasicMaterial({ map: equirectTexture })`, `texture.colorSpace = SRGBColorSpace`. `sphere.rotation.y = SPHERE_YAW_OFFSET` (constant, tune visually so image centre faces −Z).
  - Stage placeholder: `PlaneGeometry(stagePanelSize(hFov,20))` at `anglesToDirection(az,el)·20`, `lookAt(0,0,0)`, dark panel + gold edge so placement is visible. `videoUrl` prop is the sub-plan #5 seam (placeholder when absent).
  - Drag-to-look: track `lon/lat`, pointer handlers update them, each frame `camera.lookAt(anglesToDirection(lon,lat))`. Initialise `lon = stage.azimuthDeg` so the stage is in view on open.
  - Resize observer; cleanup disposes geometry/material/texture/renderer + removes listeners + cancels rAF.
- [ ] **Step 2:** `npx tsc --noEmit` clean. Commit `feat(attend): VenueViewer (three.js equirect sphere + stage marker)`.

### Task 4: Repo + preview wiring

**Files:** Modify `venue-repository.ts`, `creator/venues/page.tsx`, `venues-client.tsx`

- [ ] **Step 1: repo** `getVenueActivePano(venueId)`:

```typescript
export async function getVenueActivePano(
  venueId: string,
): Promise<{ storagePath: string; manifest: Record<string, unknown> } | null> {
  const res = await supaGet(
    'attend_venue_assets',
    `venue_id=eq.${encodeURIComponent(venueId)}&tier=eq.PANO_360&status=in.(VALIDATED,ACTIVE)&deleted_at=is.null&order=created_at.desc&limit=1&select=storage_path,manifest`,
  )
  if (!res.ok) throw new Error(`getVenueActivePano failed: ${res.status} ${await res.text()}`)
  const rows = (await res.json()) as { storage_path: string; manifest: Record<string, unknown> }[]
  return rows[0] ? { storagePath: rows[0].storage_path, manifest: rows[0].manifest } : null
}
```

- [ ] **Step 2: page** — `Promise.all` the venues' active panos; for each, build `{ url: publicVenueUrl(storagePath), stage: manifest.anchors.stageScreen }` (the `angular` stage) and pass to the client.
- [ ] **Step 3: client** — `const VenueViewer = dynamic(() => import('@/app/attend/_components/venue-viewer'), { ssr: false, loading: () => <p className="text-xs text-[#9e8a55]">Loading 3D…</p> })`. Per venue with a pano, a "Preview in 3D" toggle mounts `<VenueViewer panoUrl stage />`.
- [ ] **Step 4:** `npx tsc --noEmit` clean. Commit `feat(attend): venue 3D preview on the creator venues page`.

### Task 5: Build + ship
- [ ] `npx tsc --noEmit` clean; `npx vitest run` all pass (prior + 5 viewer-math).
- [ ] `npx next build` succeeds (Three bundles; viewer is a separate chunk).
- [ ] commit remainder, push, watch deploy.
- [ ] Smoke test: seed a temp `attend_venue_assets` row (pano pointing at a bg image) → open Preview → screenshot the canvas → clean up. Note: true stage alignment needs a real equirectangular pano + human eyes; the smoke test only confirms the pipeline mounts + renders.

---

## Follow-on plan
5. Event↔venue linkage + live Mux video on the stage panel (the `videoUrl` seam) — the attendee event-room experience.

## Remember
- DRY, YAGNI, TDD, frequent commits.
- The viewer is `ssr:false` dynamic-imported — keep all `three`/`window` usage inside it.
- `SPHERE_YAW_OFFSET` may need a visual tweak against a real pano; isolate it as one constant.
- `videoUrl` is the sub-plan #5 seam — placeholder panel when absent.
