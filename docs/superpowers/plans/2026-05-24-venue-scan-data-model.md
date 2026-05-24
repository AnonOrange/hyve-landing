# Venue Data Model + Storage Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist validated venue scans — add `attend_venues` + `attend_venue_assets` tables, a status enum, a public storage bucket, and a TS repository/service that validates a manifest (via the venue-manifest library) before storing it.

**Architecture:** Migration 036 creates the tables (RLS enabled, no policies — service-key access, matching the rest of attend) and a `attend-venue-assets` storage bucket. A pure `buildVenueAssetRecord()` maps a `ManifestValidation` result → the row to insert (status + jsonb fields). The repository does raw-REST I/O via `@/lib/supabase` helpers; `persistVenueAsset()` orchestrates validate → build record → insert.

**Tech Stack:** Supabase (Postgres + storage), TypeScript, Vitest. Depends on `src/lib/attend/venues/manifest-*` (sub-plan #1, already built).

**Spec:** `docs/superpowers/specs/2026-05-24-venue-3d-scan-requirements-design.md`

**Key decision:** venues are first-class entities (`attend_venues`) with a **nullable `managed_by`** profile ref (`null` = HYVE-managed catalog; non-null = a venue-owner/creator who can edit). Matches the spec's framing that venues provide their own scans, and supports the HYVE-contracted path too.

---

## File Structure

- Create: `supabase/migrations/036_attend_venues.sql` — tables, enum, indexes, RLS, storage bucket.
- Create: `src/lib/attend/venues/venue-record.ts` — pure `buildVenueAssetRecord()` + insert-shape types.
- Create: `src/lib/attend/venues/venue-record.test.ts` — Vitest for the status/jsonb mapping.
- Create: `src/lib/attend/venues/venue-repository.ts` — raw-REST CRUD for venues + assets (no business logic).
- Create: `src/lib/attend/venues/venue-service.ts` — `persistVenueAsset()` (validate → build → insert) + ownership/slug helpers.

`venue-record.ts` holds the only branching logic, so it's the only file that needs unit tests; the repository is thin I/O and the service is orchestration (covered by integration later).

---

## Chunk 1: Migration + pure record builder

### Task 1: Migration 036

**Files:**
- Create: `supabase/migrations/036_attend_venues.sql`

- [ ] **Step 1: Write the migration** (also apply via Supabase MCP `apply_migration`, project ref `jlyqezwuyhfevrdomazd`, name `attend_venues`)

```sql
-- HYVE Attend — venues + venue scan assets (see spec 2026-05-24). A venue is
-- a first-class place that can host events; venues provide their own scans, or
-- HYVE is contracted. Each asset carries its validated venue.json manifest +
-- storage refs + a validation lifecycle. RLS enabled, no policies (service-key
-- access, authorized in the service layer) to match the rest of attend.

create type attend_venue_asset_status as enum (
  'PENDING_VALIDATION', 'VALIDATED', 'REJECTED', 'ACTIVE', 'ARCHIVED'
);

create table if not exists attend_venues (
  id          uuid         primary key default gen_random_uuid(),
  slug        text         not null unique,
  name        text         not null,
  city        text,
  country     text,
  managed_by  uuid         references attend_profiles(id),
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now(),
  created_by  text,
  updated_by  text,
  deleted_at  timestamptz
);

create table if not exists attend_venue_assets (
  id                  uuid                       primary key default gen_random_uuid(),
  venue_id            uuid                       not null references attend_venues(id) on delete cascade,
  tier                text                       not null check (tier in ('PANO_360','NAV_MESH')),
  status              attend_venue_asset_status  not null default 'PENDING_VALIDATION',
  manifest            jsonb                      not null,
  storage_path        text                       not null,
  validation_errors   jsonb,
  validation_warnings jsonb,
  created_at          timestamptz                not null default now(),
  updated_at          timestamptz                not null default now(),
  created_by          text,
  updated_by          text,
  deleted_at          timestamptz
);

alter table attend_venues       enable row level security;
alter table attend_venue_assets enable row level security;

create index if not exists idx_attend_venues_slug on attend_venues (slug);
create index if not exists idx_attend_venues_managed_by on attend_venues (managed_by) where deleted_at is null;
create index if not exists idx_attend_venue_assets_venue on attend_venue_assets (venue_id) where deleted_at is null;
create index if not exists idx_attend_venue_assets_status on attend_venue_assets (status) where deleted_at is null;

-- Public-read bucket: venue scans are shown to attendees and the browser
-- viewer fetches them directly. Writes go through the service key only.
insert into storage.buckets (id, name, public)
values ('attend-venue-assets', 'attend-venue-assets', true)
on conflict (id) do nothing;
```

- [ ] **Step 2: Verify applied** — `list_tables` (Supabase MCP) shows `attend_venues` + `attend_venue_assets`; bucket exists.

- [ ] **Step 3: Commit the .sql file**

```bash
git add supabase/migrations/036_attend_venues.sql
git commit -m "feat(attend): migration 036 — venues + venue scan assets + bucket"
```

---

### Task 2: Pure record builder

**Files:**
- Create: `src/lib/attend/venues/venue-record.ts`
- Test: `src/lib/attend/venues/venue-record.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest'
import { buildVenueAssetRecord } from '@/lib/attend/venues/venue-record'

const base = {
  venueId: 'v1', tier: 'NAV_MESH' as const, manifest: { any: 'json' } as never,
  storagePath: 'venues/v1/scan1', actor: 'creator:123',
}

describe('buildVenueAssetRecord', () => {
  it('marks VALIDATED with no errors when validation passes', () => {
    const r = buildVenueAssetRecord({ ...base, validation: { ok: true, errors: [], warnings: [] } })
    expect(r.status).toBe('VALIDATED')
    expect(r.validation_errors).toBeNull()
    expect(r.validation_warnings).toBeNull()
    expect(r.venue_id).toBe('v1')
    expect(r.created_by).toBe('creator:123')
  })

  it('marks REJECTED and stores the error codes when validation fails', () => {
    const r = buildVenueAssetRecord({
      ...base,
      validation: { ok: false, errors: ['MISSING_SPAWN'], warnings: [] },
    })
    expect(r.status).toBe('REJECTED')
    expect(r.validation_errors).toEqual(['MISSING_SPAWN'])
  })

  it('stores warnings even when VALIDATED', () => {
    const r = buildVenueAssetRecord({
      ...base,
      validation: { ok: true, errors: [], warnings: ['STAGE_SCREEN_NOT_16_9'] },
    })
    expect(r.status).toBe('VALIDATED')
    expect(r.validation_warnings).toEqual(['STAGE_SCREEN_NOT_16_9'])
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/lib/attend/venues/venue-record.test.ts` → FAIL (not defined).

- [ ] **Step 3: Implement**

```typescript
// Pure: map a manifest validation result to the venue_asset row to insert.
// The only branching logic in this sub-plan, hence the only unit-tested file.
import type { VenueManifest, VenueTier, ManifestValidation } from '@/lib/attend/venues/manifest-types'

export interface VenueAssetInsert {
  venue_id: string
  tier: VenueTier
  status: 'VALIDATED' | 'REJECTED'
  manifest: VenueManifest
  storage_path: string
  validation_errors: string[] | null
  validation_warnings: string[] | null
  created_by: string
}

export function buildVenueAssetRecord(input: {
  venueId: string
  tier: VenueTier
  manifest: VenueManifest
  storagePath: string
  validation: ManifestValidation
  actor: string
}): VenueAssetInsert {
  const { validation } = input
  return {
    venue_id: input.venueId,
    tier: input.tier,
    status: validation.ok ? 'VALIDATED' : 'REJECTED',
    manifest: input.manifest,
    storage_path: input.storagePath,
    validation_errors: validation.errors.length ? validation.errors : null,
    validation_warnings: validation.warnings.length ? validation.warnings : null,
    created_by: input.actor,
  }
}
```

- [ ] **Step 4: Run to verify pass** — `npx vitest run src/lib/attend/venues/venue-record.test.ts` → PASS (3).

- [ ] **Step 5: Commit**

```bash
git add src/lib/attend/venues/venue-record.ts src/lib/attend/venues/venue-record.test.ts
git commit -m "feat(attend): pure venue-asset record builder"
```

---

### Task 3: Repository + service (validate-before-persist)

**Files:**
- Create: `src/lib/attend/venues/venue-repository.ts`
- Create: `src/lib/attend/venues/venue-service.ts`

Thin I/O + orchestration — no new unit tests (covered by the pure builder + a future integration test); verified by typecheck + full suite.

- [ ] **Step 1: Repository (raw-REST via `@/lib/supabase`)**

```typescript
import { supaGet, supaPost } from '@/lib/supabase'
import type { VenueAssetInsert } from '@/lib/attend/venues/venue-record'

export interface VenueRow { id: string; slug: string; name: string; managed_by: string | null }

export async function getVenueBySlug(slug: string): Promise<VenueRow | null> {
  const res = await supaGet('attend_venues', `slug=eq.${encodeURIComponent(slug)}&deleted_at=is.null&select=id,slug,name,managed_by`)
  if (!res.ok) throw new Error(`getVenueBySlug failed: ${res.status} ${await res.text()}`)
  const rows = (await res.json()) as VenueRow[]
  return rows[0] ?? null
}

export async function insertVenue(input: { slug: string; name: string; city?: string; country?: string; managedBy?: string | null; actor: string }): Promise<VenueRow> {
  const res = await supaPost('attend_venues', {
    slug: input.slug, name: input.name, city: input.city ?? null,
    country: input.country ?? null, managed_by: input.managedBy ?? null, created_by: input.actor,
  })
  if (!res.ok) throw new Error(`insertVenue failed: ${res.status} ${await res.text()}`)
  return ((await res.json()) as VenueRow[])[0]
}

export async function insertVenueAsset(record: VenueAssetInsert): Promise<{ id: string }> {
  const res = await supaPost('attend_venue_assets', record)
  if (!res.ok) throw new Error(`insertVenueAsset failed: ${res.status} ${await res.text()}`)
  return ((await res.json()) as { id: string }[])[0]
}

export async function listVenueAssets(venueId: string): Promise<unknown[]> {
  const res = await supaGet('attend_venue_assets', `venue_id=eq.${venueId}&deleted_at=is.null&order=created_at.desc`)
  if (!res.ok) throw new Error(`listVenueAssets failed: ${res.status} ${await res.text()}`)
  return (await res.json()) as unknown[]
}
```

- [ ] **Step 2: Service (validate → build → insert)**

```typescript
import type { VenueManifest, VenueTier } from '@/lib/attend/venues/manifest-types'
import { validateManifest } from '@/lib/attend/venues/manifest-validator'
import { buildVenueAssetRecord } from '@/lib/attend/venues/venue-record'
import { insertVenueAsset } from '@/lib/attend/venues/venue-repository'

/**
 * Validate a manifest and persist the resulting asset row. Returns the new
 * id plus the validation result so the caller (upload API) can surface
 * errors/warnings. A REJECTED asset is still stored — it's the audit trail
 * of what a venue submitted and why it failed.
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
```

- [ ] **Step 3: Typecheck** — `npx tsc --noEmit` → no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/attend/venues/venue-repository.ts src/lib/attend/venues/venue-service.ts
git commit -m "feat(attend): venue repository + persistVenueAsset (validate-before-persist)"
```

---

### Task 4: Full-suite gate

- [ ] **Step 1:** `npx tsc --noEmit` → clean.
- [ ] **Step 2:** `npx vitest run` → all pass (prior 107 + 3 new venue-record).
- [ ] **Step 3:** proceed to sub-plan #3 (Tier-1 self-serve upload).

---

## Follow-on plans (not in this plan)
3. Tier-1 self-serve upload (pano + guided stage-screen placement → `buildPano360Manifest` → `persistVenueAsset`).
4. Tier-1 browser viewer (textured sphere mounting Mux video on `stageScreen`).
5. CSP origin for the bucket + event↔venue linkage.

## Remember
- DRY, YAGNI, TDD, frequent commits.
- REJECTED assets are still stored (audit trail), not discarded.
- New tables MUST `enable row level security` with no policies (service-key access only) — matches the repo posture.
