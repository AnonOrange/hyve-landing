# Tier-2 Contracted Mesh Implementation Plan (architectural)

> **For agentic workers:** integration-heavy — verify by building + sample-model smoke tests, not line-by-line TDD. Pure helpers still get unit tests.

**Goal:** Support Tier-2 navigable glTF venue scans: an admin (reviewer) uploads a HYVE-contracted optimized `.glb` to a venue, and attendees can walk through it in the room with the live stream on the stage.

**Architecture:** Reuse the existing manifest contract (the validator already accepts `NAV_MESH` + node-based `stageScreen`). Add a `buildNavMeshManifest` builder and a reviewer-gated mesh-upload route (mesh is contracted, so intake is admin-side, not self-serve). Generalize the venue scan fetch to be tier-aware. Extend `VenueViewer` to branch on `tier`: `PANO_360` → today's sphere; `NAV_MESH` → `GLTFLoader` (+ Draco from gstatic, already CSP-allowed; + bundled MeshoptDecoder), camera at spawn, drag-look + WASD, video/placeholder on the `ANCHOR_stage_screen` node.

**Tech Stack:** three + three/addons (GLTFLoader, DRACOLoader, MeshoptDecoder), hls.js, Supabase. Draco decoder from `https://www.gstatic.com/draco/...` (CSP `*.gstatic.com` already allowed). KTX2 textures: best-effort — wire `KTX2Loader` if a transcoder is available; plain/Draco glTF is the reliable path for now.

**Spec:** `docs/superpowers/specs/2026-05-24-venue-3d-scan-requirements-design.md` §4.

---

## File structure
- Modify `venues/manifest-builder.ts` — add `buildNavMeshManifest(input)` (tier NAV_MESH; `stageScreen` kind `rect`+`node`; spawn; scaleRef; `asset.type='glb'`).
- Modify `venues/manifest-builder.test.ts` — assert the mesh manifest validates.
- Modify `venues/venue-repository.ts` — `getVenueActiveScan(venueId)` → `{ tier, storagePath, manifest } | null` for the latest VALIDATED/ACTIVE asset of *either* tier (prefer NAV_MESH if both, else most recent); keep `getVenueActivePano` or replace its callers.
- Create `api/attend/admin/venues/[id]/mesh/route.ts` — reviewer-gated `.glb` upload + manifest fields → `uploadVenueObject` + `persistVenueAsset(NAV_MESH)`.
- Modify `attend/admin/sponsors`-style admin page → actually a new `attend/admin/venues` area, OR fold mesh upload into the existing `/attend/creator/venues` for an ADMIN viewing. Decision: add a reviewer-only "Upload contracted mesh" affordance on the creator venues page (gated server-side in the route), simplest. (Revisit if it muddies creator UX → separate admin page.)
- Modify `_components/venue-viewer.tsx` — `tier` prop; `NAV_MESH` render path (loaders, nav, stage node). Keep sphere path unchanged.
- Modify `venues/viewer-math.ts` — `nodeStageFromManifest` (rect/node variant) alongside `angularStageFromManifest`; a shared `VenueScan` type `{ tier, url, stage, meshStageNode? }`.
- Modify venues page + venues-client + room-service + room-client — pass `tier` + scan through; viewer branches.

## Key decisions
- **Intake is reviewer-gated** (mesh = contracted). The route checks `requireReviewer`.
- **Camera/nav:** start at `ANCHOR_spawn` (or manifest `spawn.positionM`); drag-look + WASD translate on the XZ plane, clamped to a height; full collision/navmesh is deferred (constrain to a sane bounding box for beta).
- **Stage video:** find `ANCHOR_stage_screen` node in the loaded scene; if absent, fall back to a rect plane at the manifest's stage placement. Mount the same hls.js VideoTexture used by Tier 1.
- **Lighting:** spec says baked → add a low ambient + hemisphere light as a safety net so PBR materials aren't pure black if a model lacks baked light.
- **Verification reality:** no real contracted `.glb` exists; smoke-test with a public sample glTF (anchors may be absent → exercises the fallback path). Real-venue correctness awaits an actual scan.

## Out of scope (→ sub-plan #7)
Gaussian splatting (Tier 3): splat renderer + parallel proxy mesh + dual-file intake.

## Remember
- Sphere (Tier 1) path stays byte-unchanged; mesh is an added branch.
- Draco from gstatic (CSP ok). Don't add a CSP entry unless a new origin is actually fetched.
- Dispose GLTF scene graph (geometries/materials/textures) + loaders on unmount.
