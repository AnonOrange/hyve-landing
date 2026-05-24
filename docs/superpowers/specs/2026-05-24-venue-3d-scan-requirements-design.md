# Venue 3D Scan Intake Specification — Design

**Date:** 2026-05-24
**Status:** Approved (brainstorm)
**Topic:** What HYVE Attend requires from a venue's 3D/360° scan so it works with our software, across both intake paths (venue self-serve and HYVE-contracted scanning).

---

## Context

- HYVE Attend is **browser-first, mobile-ready** ("watch from any browser, no app"). The live event room today is a 2D Mux HLS video player + chat/reactions — there is **no 3D rendering in the product yet**.
- "3D venues / Scan Your Venue Into 3D" is currently a marketing concept (ad imagery), not built. The build bible defers it to **Phase 8** ("WebXR proof of concept", "3D hall", *"Do not jump to VR"*, *"Do not block core web/mobile experience"*). VR/3D is a premium add-on.
- Therefore the scan requirements must be bounded by what renders in **WebGL/WebXR on a mid-range phone**, and must be achievable across two sources: venues capturing their own, and HYVE being contracted to capture.

This document specifies **intake only** — what a conforming scan must contain. The software that *consumes* scans (asset store, validator, browser viewer, CSP changes) is a separate, later build (Phase 8) and is intentionally out of scope here. Defining intake independently lets us hand requirements to venue partners and a scanning vendor *before* any viewer code exists.

---

## Decisions (locked during brainstorm)

1. **Tiered intake**, launch the floor first:
   - **Tier 1 — 360° backdrop** (self-serve) ships first.
   - **Tier 2 — navigable optimized mesh** (HYVE-contracted premium) = the build bible's "3D hall".
   - **Tier 3 — Gaussian splatting** named but **parked** (deferred until WebGPU + web viewers are a safe universal bet).
2. **Single stage screen** video placement: each scan designates exactly one anchor where the live Mux 16:9 stream plays. Plus a default spawn/viewpoint and real-world scale.
3. **Ad surfaces = optional metadata, reserved.** Scans may tag ad-surface zones; the format is defined now, but they are not required and ad-serving into venues is not built yet (preserves the "monetise your venue 24/7" hook).

---

## 1. Core idea — the manifest is the contract

A raw scan (pixels or geometry) cannot be used by our renderer alone: it does not encode *where the show plays* or *where the attendee stands*. So **every accepted scan = the asset + a `venue.json` manifest** carrying the anchors. The manifest decouples the venue's capture problem from our rendering problem: any tool/pipeline is acceptable as long as the output conforms. Our software never cares how a scan was made — only that the anchors are present and valid.

### Universal conventions (all tiers)

- **Real-world scale**: 1 unit = 1 metre. A scan not at real-world scale is **rejected** (a 1.7 m avatar/eye-height must read correctly).
- **Axes**: Y-up, −Z forward (glTF 2.0 standard).
- **Colour**: sRGB.

---

## 2. Required anchor set (all tiers)

| Anchor | Purpose | Mesh representation | 360° representation |
|---|---|---|---|
| `stageScreen` | The one rectangle the live Mux 16:9 video maps onto | Named node + width/height (m) | Azimuth/elevation + angular size in the pano |
| `spawn` | Default viewpoint | Position (m) + look direction | Camera nodal point + forward azimuth |
| `scaleReference` | Validate real-world scale | A known measurement (e.g. 2.03 m door) | Same |
| `adSurfaces[]` *(optional)* | Reserved monetizable zones | Named nodes + rect dims | Angular rects |

Non-16:9 stage screens are letterboxed by the renderer.

---

## 3. Tier 1 — 360° backdrop (self-serve, ships first)

- **Capture**: stationary 360 camera (Insta360 X-series, Ricoh Theta) or phone pano, tripod ~1.6 m, shot from the intended viewer position.
- **Format**: equirectangular **2:1**, **min 6K (6144×3072), max 8K**, JPEG q≈85, horizon-levelled, sRGB. Extra viewpoints = extra panos, each its own manifest entry.
- **Size ceiling**: ≤ 25 MB per pano.
- **Renders as**: textured sphere with the live video plane composited at the `stageScreen` angle. Trivial GPU; runs on any phone. Reuses the existing "video + room" model with the room being a sphere instead of a flat page.

---

## 4. Tier 2 — navigable mesh (HYVE-contracted premium)

- **Format**: glTF 2.0 binary **(.glb)**, **Draco or meshopt** geometry compression, **KTX2/Basis** textures.
- **Budget (mobile target)**: ≤ **300k triangles** total (150k ideal for low-end), textures ≤ **4096²** (prefer a few 2K atlases), total `.glb` ≤ **40 MB** (15 MB ideal).
- **Geometry**: watertight within the walkable area, correct outward normals, no missing floor/walls.
- **Navigation**: a named **`nav_floor`** node defines where attendees may walk (collision proxy optional for beta — constrain to the polygon).
- **Lighting**: baked into textures (no reliance on real-time lights for beta). PBR metallic-roughness materials.
- **Anchors as named empty nodes**: `ANCHOR_stage_screen`, `ANCHOR_spawn`, `ANCHOR_ad_*`.
- **Origin**: floor centre of the audience area; Y-up; metres.
- **Why contracted**: venues almost never produce a game-ready, budget-conformant `.glb`. HYVE captures (LiDAR/photogrammetry) → decimate → retopo → bake → optimise → emit `.glb` + manifest. This is what *"contracted for scanning"* delivers.

---

## 5. Tier 3 — Gaussian splatting (named, parked)

Future format: `.spz`/`.ply` splat **+ a parallel proxy mesh** (splats are point clouds with no surfaces, so anchors/navigation need a companion mesh). Deferred until WebGPU support and web splat viewers are broadly safe on phones. **Not built now**; named so venues and contracts can see the roadmap.

---

## 6. `venue.json` manifest schema

The single artifact that makes a scan "work with our software":

```json
{
  "manifestVersion": "1.0",
  "tier": "PANO_360 | NAV_MESH",
  "asset": { "type": "equirect | glb", "files": ["main.glb"], "splatProxy": null },
  "world": { "unit": "meter", "upAxis": "Y", "forwardAxis": "-Z" },
  "anchors": {
    "stageScreen": { "kind": "rect", "node": "ANCHOR_stage_screen",
                     "widthM": 8, "heightM": 4.5, "aspect": "16:9" },
    "spawn": { "positionM": [0, 1.6, 12], "yawDeg": 0 },
    "scaleReference": { "description": "main entry door", "realMeters": 2.03 }
  },
  "adSurfaces": [
    { "id": "lobby-banner-1", "kind": "rect", "node": "ANCHOR_ad_1",
      "widthM": 3, "heightM": 1 }
  ],
  "capture": { "method": "insta360x4 | matterport | photogrammetry",
               "capturedAt": "2026-05-24", "operator": "venue | hyve-contracted" },
  "rights": { "ownerWarrantsRights": true, "brandingCleared": true }
}
```

For Tier 1 (PANO_360), `stageScreen` uses an angular form instead of a node, e.g. `{ "kind": "angular", "azimuthDeg": 0, "elevationDeg": 0, "hFovDeg": 60 }`, and `spawn` is implicit at the pano nodal point.

---

## 7. QA / validation, rejection criteria & intake paths

### Auto-validation on intake
- Scale within tolerance (against `scaleReference`).
- `stageScreen` present, ~16:9, faces `spawn`.
- `spawn` inside `nav_floor` (mesh) and not clipping geometry.
- Within size / poly / texture budget for the tier.
- (Mesh) loads in our validator; normals correct; single scene; Y-up; metres.
- (360°) equirectangular 2:1; ≥ 6K; horizon level.
- `rights.ownerWarrantsRights` true.

Each failure returns an **enumerated, actionable reject reason** so venues can fix and resubmit.

### Rights / legal
The venue must warrant they hold the rights to scan and distribute the space and any visible branding/artwork. Required field in the manifest; doubly important on the contracted path.

### Two intake paths
- **Self-serve (Tier 1)**: venue uploads pano(s); a guided web step lets them click to place the stage screen in a live preview → we generate the manifest → auto-validate.
- **Contracted (Tier 2/3)**: HYVE scanning engagement — we capture, process, deliver the optimised `.glb` + manifest; venue reviews and approves. Pricing/SOW referenced, not specified here.

---

## Out of scope (separate, later build — Phase 8)

- Venue asset store (Supabase storage + `attend_venues` / `attend_venue_assets` tables).
- Manifest validator service.
- Browser viewer: textured-sphere (Tier 1) / glTF loader (Tier 2) that mounts the Mux video onto `stageScreen`.
- CSP addition for a venue-asset CDN origin in `next.config.mjs`.
- In-venue ad serving against `adSurfaces`.
- Avatar presence / spatial audio / WebXR navigation (Tier 2 VR layer).

---

## YAGNI notes

- Tier 3 (splatting) and multi-screen placement are deliberately excluded from the build floor.
- `adSurfaces` is data-only now; no serving.
- Collision is a nav-polygon constraint, not full physics, for beta.
