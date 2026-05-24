# Venue Manifest Library Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure-TypeScript `venue-manifest` library — types, a validator, and a Tier-1 (360°) manifest generator — that defines and enforces the `venue.json` contract from the venue-scan intake spec.

**Architecture:** Three pure modules with no I/O (no DB, no Stripe, no browser), colocated with Vitest tests, mirroring the existing `src/lib/attend/payments/fee-calculator.ts` and `src/lib/attend/payouts/settlement-math.ts` pattern. `manifest-types.ts` defines the shapes; `manifest-validator.ts` returns enumerated errors + warnings; `manifest-builder.ts` constructs a valid Tier-1 manifest from self-serve inputs. Downstream subsystems (storage, upload UI, viewer) depend on this library but are out of scope for this plan.

**Tech Stack:** TypeScript (strict), Vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-24-venue-3d-scan-requirements-design.md`

---

## File Structure

- Create: `src/lib/attend/venues/manifest-types.ts` — interfaces + enums for `VenueManifest`, anchors, ad surfaces, tiers, and the validator result type. Single responsibility: the shape of the contract.
- Create: `src/lib/attend/venues/manifest-validator.ts` — `validateManifest(input: unknown): ManifestValidation`. Pure; returns `{ ok, errors[], warnings[] }` with enumerated codes.
- Create: `src/lib/attend/venues/manifest-validator.test.ts` — Vitest coverage of every reject code + warning + happy paths for both tiers.
- Create: `src/lib/attend/venues/manifest-builder.ts` — `buildPano360Manifest(input): VenueManifest` for the self-serve Tier-1 flow.
- Create: `src/lib/attend/venues/manifest-builder.test.ts` — Vitest coverage of the generator (incl. that its output passes `validateManifest`).

Conventions to follow (from the codebase):
- Pure functions only; integer where it matters, but metres are floats here.
- Throw `ValidationError` is **not** used here — the validator returns a result object (callers decide HTTP status), unlike the throwing service layer. This keeps it composable for both the upload API and a future admin re-check.

---

## Chunk 1: Venue manifest library

### Task 1: Manifest types

**Files:**
- Create: `src/lib/attend/venues/manifest-types.ts`

Pure type definitions have no runtime behaviour, so they're verified by `tsc`, not a unit test.

- [ ] **Step 1: Write the types file**

```typescript
// Venue scan manifest — the contract between a venue's 3D/360 scan and the
// HYVE Attend renderer. See docs/superpowers/specs/2026-05-24-venue-3d-scan-
// requirements-design.md. Pure types; no I/O.

export type VenueTier = 'PANO_360' | 'NAV_MESH'

export type StageScreenAnchor =
  | { kind: 'rect'; node: string; widthM: number; heightM: number; aspect?: string }
  | { kind: 'angular'; azimuthDeg: number; elevationDeg: number; hFovDeg: number }

export interface SpawnAnchor {
  positionM: [number, number, number]
  yawDeg: number
}

export interface ScaleReference {
  description: string
  realMeters: number
}

export interface AdSurface {
  id: string
  kind: 'rect'
  node?: string
  widthM: number
  heightM: number
}

export interface VenueManifest {
  manifestVersion: string
  tier: VenueTier
  asset: { type: 'equirect' | 'glb'; files: string[]; splatProxy?: string | null }
  world: { unit: 'meter'; upAxis: 'Y'; forwardAxis: '-Z' }
  anchors: {
    stageScreen: StageScreenAnchor
    spawn: SpawnAnchor
    scaleReference: ScaleReference
  }
  adSurfaces?: AdSurface[]
  capture: { method: string; capturedAt: string; operator: 'venue' | 'hyve-contracted' }
  rights: { ownerWarrantsRights: boolean; brandingCleared: boolean }
}

export type ManifestErrorCode =
  | 'NOT_AN_OBJECT'
  | 'MISSING_MANIFEST_VERSION'
  | 'UNSUPPORTED_TIER'
  | 'WRONG_UNIT'
  | 'WRONG_UP_AXIS'
  | 'ASSET_MISSING_FILES'
  | 'MISSING_STAGE_SCREEN'
  | 'PANO_REQUIRES_ANGULAR_STAGE'
  | 'MESH_REQUIRES_NODE_STAGE'
  | 'MISSING_SPAWN'
  | 'MISSING_SCALE_REFERENCE'
  | 'INVALID_SCALE_REFERENCE'
  | 'AD_SURFACE_INVALID'
  | 'RIGHTS_NOT_WARRANTED'

export type ManifestWarningCode = 'STAGE_SCREEN_NOT_16_9'

export interface ManifestValidation {
  ok: boolean
  errors: ManifestErrorCode[]
  warnings: ManifestWarningCode[]
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/attend/venues/manifest-types.ts
git commit -m "feat(attend): venue manifest types"
```

---

### Task 2: validateManifest — core conventions + required anchors

**Files:**
- Create: `src/lib/attend/venues/manifest-validator.ts`
- Test: `src/lib/attend/venues/manifest-validator.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest'
import { validateManifest } from '@/lib/attend/venues/manifest-validator'

const validMesh = {
  manifestVersion: '1.0',
  tier: 'NAV_MESH',
  asset: { type: 'glb', files: ['main.glb'] },
  world: { unit: 'meter', upAxis: 'Y', forwardAxis: '-Z' },
  anchors: {
    stageScreen: { kind: 'rect', node: 'ANCHOR_stage_screen', widthM: 8, heightM: 4.5 },
    spawn: { positionM: [0, 1.6, 12], yawDeg: 0 },
    scaleReference: { description: 'door', realMeters: 2.03 },
  },
  capture: { method: 'matterport', capturedAt: '2026-05-24', operator: 'hyve-contracted' },
  rights: { ownerWarrantsRights: true, brandingCleared: true },
}

describe('validateManifest — core', () => {
  it('accepts a well-formed mesh manifest', () => {
    const r = validateManifest(validMesh)
    expect(r.ok).toBe(true)
    expect(r.errors).toEqual([])
  })

  it('rejects wrong unit and missing version', () => {
    const r = validateManifest({ ...validMesh, manifestVersion: '', world: { ...validMesh.world, unit: 'feet' } })
    expect(r.ok).toBe(false)
    expect(r.errors).toContain('MISSING_MANIFEST_VERSION')
    expect(r.errors).toContain('WRONG_UNIT')
  })

  it('rejects missing required anchors', () => {
    const r = validateManifest({ ...validMesh, anchors: {} })
    expect(r.errors).toContain('MISSING_STAGE_SCREEN')
    expect(r.errors).toContain('MISSING_SPAWN')
    expect(r.errors).toContain('MISSING_SCALE_REFERENCE')
  })

  it('rejects non-object input with NOT_AN_OBJECT', () => {
    expect(validateManifest(null).errors).toContain('NOT_AN_OBJECT')
    expect(validateManifest('x').errors).toContain('NOT_AN_OBJECT')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/attend/venues/manifest-validator.test.ts`
Expected: FAIL — `validateManifest` is not defined.

- [ ] **Step 3: Write minimal implementation**

```typescript
// Pure validator for venue scan manifests. Returns enumerated errors +
// warnings; does NOT throw (callers map to HTTP). See spec §6/§7.
import type {
  VenueManifest, ManifestValidation, ManifestErrorCode, ManifestWarningCode,
} from '@/lib/attend/venues/manifest-types'

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

export function validateManifest(input: unknown): ManifestValidation {
  const errors: ManifestErrorCode[] = []
  const warnings: ManifestWarningCode[] = []
  if (!isObject(input)) return { ok: false, errors: ['NOT_AN_OBJECT'], warnings: [] }

  const m = input as Partial<VenueManifest>

  if (!m.manifestVersion) errors.push('MISSING_MANIFEST_VERSION')
  if (m.tier !== 'PANO_360' && m.tier !== 'NAV_MESH') errors.push('UNSUPPORTED_TIER')

  if (!m.world || m.world.unit !== 'meter') errors.push('WRONG_UNIT')
  if (!m.world || m.world.upAxis !== 'Y') errors.push('WRONG_UP_AXIS')

  if (!m.asset || !Array.isArray(m.asset.files) || m.asset.files.length === 0) {
    errors.push('ASSET_MISSING_FILES')
  }

  const a = m.anchors
  if (!a || !a.stageScreen) errors.push('MISSING_STAGE_SCREEN')
  if (!a || !a.spawn) errors.push('MISSING_SPAWN')
  if (!a || !a.scaleReference) errors.push('MISSING_SCALE_REFERENCE')

  if (!m.rights || m.rights.ownerWarrantsRights !== true) errors.push('RIGHTS_NOT_WARRANTED')

  return { ok: errors.length === 0, errors, warnings }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/attend/venues/manifest-validator.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/attend/venues/manifest-validator.ts src/lib/attend/venues/manifest-validator.test.ts
git commit -m "feat(attend): venue manifest validator — core conventions + anchors"
```

---

### Task 3: Tier-specific stage-screen shape + scale-reference + aspect warning

**Files:**
- Modify: `src/lib/attend/venues/manifest-validator.ts`
- Modify: `src/lib/attend/venues/manifest-validator.test.ts`

Design decisions this task pins down:
- **PANO_360** must use the `angular` stage-screen shape; **NAV_MESH** must use the `rect` (node) shape. Mismatch → hard error.
- `scaleReference.realMeters` must be > 0 → else `INVALID_SCALE_REFERENCE`.
- A `rect` stage screen whose `widthM/heightM` deviates from 16:9 by more than ±5% → **warning** `STAGE_SCREEN_NOT_16_9` (NOT an error — the renderer letterboxes, per spec).

- [ ] **Step 1: Write the failing tests**

```typescript
describe('validateManifest — tier shape + scale + aspect', () => {
  it('rejects a pano manifest that uses a rect stage screen', () => {
    const r = validateManifest({
      ...validMesh, tier: 'PANO_360', asset: { type: 'equirect', files: ['pano.jpg'] },
    })
    expect(r.errors).toContain('PANO_REQUIRES_ANGULAR_STAGE')
  })

  it('rejects a mesh manifest with an angular stage screen', () => {
    const r = validateManifest({
      ...validMesh,
      anchors: { ...validMesh.anchors,
        stageScreen: { kind: 'angular', azimuthDeg: 0, elevationDeg: 0, hFovDeg: 60 } },
    })
    expect(r.errors).toContain('MESH_REQUIRES_NODE_STAGE')
  })

  it('rejects non-positive scale reference', () => {
    const r = validateManifest({
      ...validMesh, anchors: { ...validMesh.anchors,
        scaleReference: { description: 'door', realMeters: 0 } },
    })
    expect(r.errors).toContain('INVALID_SCALE_REFERENCE')
  })

  it('warns (does not reject) when a rect stage screen is not 16:9', () => {
    const r = validateManifest({
      ...validMesh, anchors: { ...validMesh.anchors,
        stageScreen: { kind: 'rect', node: 'ANCHOR_stage_screen', widthM: 4, heightM: 4 } },
    })
    expect(r.ok).toBe(true)
    expect(r.warnings).toContain('STAGE_SCREEN_NOT_16_9')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/attend/venues/manifest-validator.test.ts`
Expected: FAIL — new codes not yet emitted.

- [ ] **Step 3: Implement — add after the required-anchor block, before the rights check**

```typescript
  // Tier-specific stage-screen shape.
  if (a?.stageScreen) {
    const ss = a.stageScreen as Record<string, unknown>
    if (m.tier === 'PANO_360' && ss.kind !== 'angular') errors.push('PANO_REQUIRES_ANGULAR_STAGE')
    if (m.tier === 'NAV_MESH' && ss.kind !== 'rect') errors.push('MESH_REQUIRES_NODE_STAGE')
    // Aspect warning only applies to rect screens; renderer letterboxes others.
    if (ss.kind === 'rect' && typeof ss.widthM === 'number' && typeof ss.heightM === 'number'
        && ss.heightM > 0) {
      const aspect = ss.widthM / ss.heightM
      const target = 16 / 9
      if (Math.abs(aspect - target) / target > 0.05) warnings.push('STAGE_SCREEN_NOT_16_9')
    }
  }

  if (a?.scaleReference && !(a.scaleReference.realMeters > 0)) {
    errors.push('INVALID_SCALE_REFERENCE')
  }
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/attend/venues/manifest-validator.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/attend/venues/manifest-validator.ts src/lib/attend/venues/manifest-validator.test.ts
git commit -m "feat(attend): venue manifest tier-shape + scale + 16:9 aspect warning"
```

---

### Task 4: Ad-surface validation

**Files:**
- Modify: `src/lib/attend/venues/manifest-validator.ts`
- Modify: `src/lib/attend/venues/manifest-validator.test.ts`

Ad surfaces are optional, but if present each must have a non-empty `id` and positive dims → else `AD_SURFACE_INVALID`.

- [ ] **Step 1: Write the failing tests**

```typescript
describe('validateManifest — ad surfaces', () => {
  it('accepts a manifest with valid ad surfaces', () => {
    const r = validateManifest({
      ...validMesh,
      adSurfaces: [{ id: 'lobby-1', kind: 'rect', node: 'ANCHOR_ad_1', widthM: 3, heightM: 1 }],
    })
    expect(r.ok).toBe(true)
  })

  it('rejects an ad surface with empty id or non-positive dims', () => {
    const r = validateManifest({
      ...validMesh,
      adSurfaces: [{ id: '', kind: 'rect', widthM: 0, heightM: 1 }],
    })
    expect(r.errors).toContain('AD_SURFACE_INVALID')
  })

  it('treats a missing adSurfaces array as valid (optional)', () => {
    expect(validateManifest(validMesh).ok).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/attend/venues/manifest-validator.test.ts`
Expected: FAIL — `AD_SURFACE_INVALID` not yet emitted.

- [ ] **Step 3: Implement — add before the final return**

```typescript
  if (Array.isArray(m.adSurfaces)) {
    for (const s of m.adSurfaces) {
      const ok = isObject(s) && typeof s.id === 'string' && s.id.length > 0
        && typeof s.widthM === 'number' && s.widthM > 0
        && typeof s.heightM === 'number' && s.heightM > 0
      if (!ok) { errors.push('AD_SURFACE_INVALID'); break }
    }
  }
```

(Note: the final return's `ok` is already `errors.length === 0`, so no change there.)

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/attend/venues/manifest-validator.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/attend/venues/manifest-validator.ts src/lib/attend/venues/manifest-validator.test.ts
git commit -m "feat(attend): venue manifest ad-surface validation"
```

---

### Task 5: buildPano360Manifest generator

**Files:**
- Create: `src/lib/attend/venues/manifest-builder.ts`
- Test: `src/lib/attend/venues/manifest-builder.test.ts`

This powers the self-serve Tier-1 flow: the venue uploads a pano and clicks where the stage screen sits; the UI passes the chosen azimuth/elevation/FOV here and gets a valid manifest back.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest'
import { buildPano360Manifest } from '@/lib/attend/venues/manifest-builder'
import { validateManifest } from '@/lib/attend/venues/manifest-validator'

describe('buildPano360Manifest', () => {
  it('produces a PANO_360 manifest that passes validation', () => {
    const m = buildPano360Manifest({
      file: 'pano.jpg',
      stageAzimuthDeg: 10, stageElevationDeg: -2, stageHFovDeg: 55,
      scaleReference: { description: 'main door', realMeters: 2.03 },
      capturedAt: '2026-05-24', method: 'insta360x4', operator: 'venue',
      ownerWarrantsRights: true, brandingCleared: true,
    })
    expect(m.tier).toBe('PANO_360')
    expect(m.asset).toEqual({ type: 'equirect', files: ['pano.jpg'] })
    expect(m.anchors.stageScreen).toMatchObject({ kind: 'angular', azimuthDeg: 10, hFovDeg: 55 })
    expect(validateManifest(m).ok).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/attend/venues/manifest-builder.test.ts`
Expected: FAIL — `buildPano360Manifest` not defined.

- [ ] **Step 3: Implement**

```typescript
// Build a valid Tier-1 (360°) venue manifest from self-serve inputs.
// Pure — the upload UI feeds it the user's stage-screen placement.
import type { VenueManifest, ScaleReference } from '@/lib/attend/venues/manifest-types'

export interface Pano360Input {
  file: string
  stageAzimuthDeg: number
  stageElevationDeg: number
  stageHFovDeg: number
  scaleReference: ScaleReference
  capturedAt: string
  method: string
  operator: 'venue' | 'hyve-contracted'
  ownerWarrantsRights: boolean
  brandingCleared: boolean
}

export function buildPano360Manifest(input: Pano360Input): VenueManifest {
  return {
    manifestVersion: '1.0',
    tier: 'PANO_360',
    asset: { type: 'equirect', files: [input.file] },
    world: { unit: 'meter', upAxis: 'Y', forwardAxis: '-Z' },
    anchors: {
      stageScreen: {
        kind: 'angular',
        azimuthDeg: input.stageAzimuthDeg,
        elevationDeg: input.stageElevationDeg,
        hFovDeg: input.stageHFovDeg,
      },
      spawn: { positionM: [0, 1.6, 0], yawDeg: input.stageAzimuthDeg },
      scaleReference: input.scaleReference,
    },
    capture: { method: input.method, capturedAt: input.capturedAt, operator: input.operator },
    rights: {
      ownerWarrantsRights: input.ownerWarrantsRights,
      brandingCleared: input.brandingCleared,
    },
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/attend/venues/manifest-builder.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/attend/venues/manifest-builder.ts src/lib/attend/venues/manifest-builder.test.ts
git commit -m "feat(attend): Tier-1 venue manifest builder"
```

---

### Task 6: Full-suite gate

**Files:** none (verification only)

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Run the whole test suite**

Run: `npx vitest run`
Expected: all prior tests + the new venue tests pass (≈ 95 + new venue cases).

- [ ] **Step 3: Confirm no regressions, then proceed to the next sub-plan** (venue data model + storage).

---

## Follow-on plans (not in this plan)

1. **Venue data model + storage** — `attend_venues`, `attend_venue_assets` tables (migration), Supabase storage bucket, repository functions. Persists a validated manifest + asset references.
2. **Tier-1 self-serve upload** — pano upload + guided stage-screen placement UI that calls `buildPano360Manifest`, then `validateManifest`, then stores.
3. **Tier-1 browser viewer** — textured-sphere renderer that reads the manifest and composites the live Mux video at the `stageScreen` angle.
4. **CSP + event↔venue linkage** — add the venue-asset CDN origin to `next.config.mjs`; let an event reference a venue scan.

## Remember
- DRY, YAGNI, TDD, frequent commits.
- The validator does not throw — it returns a result; the upload API maps `ok:false` to a 422 with the error codes.
- Warnings never block acceptance; only `errors` do.
- `capture.*` and `rights.brandingCleared` are intentionally **informational** (stored, not validated beyond presence) — only `rights.ownerWarrantsRights` is enforced. This is deliberate, not an omission.
