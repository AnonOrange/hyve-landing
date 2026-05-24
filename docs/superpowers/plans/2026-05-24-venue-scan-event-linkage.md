# Event↔Venue Linkage + Live 3D Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Link an event to a venue, and let attendees watch the live show inside that 3D venue — the live Mux stream mounted on the stage screen — completing the venue-scan feature.

**Architecture:** `attend_events.venue_id` (nullable FK). A creator picks a venue on the event dashboard. The room loads the linked venue's pano and offers an **additive, default-off** 2D/3D toggle: 3D swaps the flat `MuxPlayer` for `VenueViewer` with the live HLS on the stage panel. The viewer gains an optional `videoUrl` → `THREE.VideoTexture` via hls.js (already a dep). CSP already allows `*.supabase.co` (pano) + `stream.mux.com` (HLS).

**Tech Stack:** Supabase, Three.js, hls.js, TypeScript. Depends on sub-plans #1–#4.

**Key constraint:** the room is the core live experience — the 3D change must be purely additive (new toggle, default 2D unchanged), never altering the existing flat-player path.

---

## File Structure
- Create: `supabase/migrations/038_attend_event_venue.sql` — `venue_id` FK + index.
- Modify: `events/repository.ts` — `EventRow.venue_id`; `setEventVenue()`.
- Modify: `events/service.ts` — `linkEventVenue(eventId, venueId|null, creatorId)` (ownership-checked).
- Create: `api/attend/events/[id]/venue/route.ts` — `PUT` set/clear venue.
- Modify: `creator/events/[id]/page.tsx` — fetch creator venues; pass to client.
- Modify: `creator/events/[id]/event-dashboard-client.tsx` — venue picker.
- Modify: `_components/venue-viewer.tsx` — optional `videoUrl` (VideoTexture).
- Modify: `streaming/room-service.ts` — `RoomView.venuePano`.
- Modify: `events/[slug]/room/page.tsx` + `room-client.tsx` — pass + 2D/3D toggle.

---

## Chunk 1: Linkage + live 3D

### Task 1: Migration 038
- [ ] Apply (Supabase MCP, project `jlyqezwuyhfevrdomazd`, name `attend_event_venue`) + save .sql:
```sql
alter table attend_events add column if not exists venue_id uuid references attend_venues(id);
create index if not exists idx_attend_events_venue on attend_events (venue_id) where deleted_at is null;
```
- [ ] Verify column exists. Commit the .sql.

### Task 2: Repo + service + API
- [ ] `EventRow` += `venue_id: string | null`.
- [ ] Repo `setEventVenue(eventId, venueId, actor)`:
```typescript
export async function setEventVenue(eventId: string, venueId: string | null, actor: string): Promise<void> {
  const res = await supaPatch('attend_events', `id=eq.${encodeURIComponent(eventId)}`,
    { venue_id: venueId, updated_at: new Date().toISOString(), updated_by: actor })
  if (!res.ok) throw new Error(`setEventVenue failed: ${res.status} ${await res.text()}`)
}
```
- [ ] Service `linkEventVenue(eventId, venueId, creatorId)`: load event (getEventById), `NotFoundError` / `ForbiddenError` if not owner; if `venueId` non-null, verify it's a venue managed by the creator (getVenueBySlug-style by id — add `getVenueById` or check via listVenuesManagedBy); then `setEventVenue`.
- [ ] API `PUT /api/attend/events/[id]/venue`, requireCreator, body `{ venueId: string | null }`, map ValidationError/Forbidden/NotFound. `runtime='nodejs'`. Commit.

### Task 3: Event dashboard venue picker
- [ ] Page: `listVenuesManagedBy(profile.id)` → pass `venues` + `event.venue_id` to client.
- [ ] Client: a `<select>` of venues (+ "None"); on change `PUT …/venue` then reload. Small section near the top of the dashboard, only meaningful once the creator has venues (link to `/attend/creator/venues` if none). Commit.

### Task 4: VenueViewer live video
- [ ] Add optional `videoUrl?: string`. When present: create an offscreen `<video>` (`crossOrigin='anonymous'`, `playsInline`, `loop=false`); Safari native HLS via `video.src`, else dynamic-import `hls.js` → `loadSource`/`attachMedia`; `new THREE.VideoTexture(video)` as the panel `map` (replace the dark placeholder); `video.play().catch(()=>{})`. Cleanup: `hls?.destroy()`, pause + null `src`, dispose the texture. Keep the placeholder when `videoUrl` absent. Commit.

### Task 5: Room 2D/3D toggle
- [ ] `getRoomView`: after access, if `access.event.venue_id`, `getVenueActivePano(venue_id)` → set `venuePano: { url, stage } | null` on `RoomView` (reuse the `stageFromManifest` shape — extract a tiny shared helper or inline).
- [ ] room `page.tsx`: pass `venuePano` to `RoomClient`.
- [ ] `room-client.tsx`: new prop `venuePano`. If present, a small **"2D / 3D venue"** toggle (default 2D). In the `lg:col-span-2` slot: 2D → existing `MuxPlayer` (unchanged); 3D → `VenueViewer` (dynamic) with `panoUrl`, `stage`, and `videoUrl = https://stream.mux.com/${playbackId}.m3u8?token=${playbackToken}` when playback exists. Everything else (check-in, LivePanel, waiting-room) untouched. Commit.

### Task 6: Verify + ship
- [ ] Confirm CSP already covers `*.supabase.co` + `stream.mux.com` (next.config.mjs) — no change expected.
- [ ] `npx tsc --noEmit`; `npx vitest run` (119 pass, no new pure logic → count steady); `npx next build`.
- [ ] Commit remainder, push, deploy.
- [ ] Verify: link a venue to an event via the dashboard (persists); the 2D room still renders; the 3D toggle appears only when a venue is linked. Live-video-in-3D needs a real live event to fully see — note it.

---

## Remember
- Room change is ADDITIVE: default 2D, existing flat path untouched.
- No new CSP expected (pano = *.supabase.co, HLS = stream.mux.com, both already allowed).
- This is the last sub-plan — venue-scan feature complete after it.
