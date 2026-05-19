# HYVE Attend — Phase 5b: The Event Room Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax. Executed in-session against the `attend-phase-5b-event-room` branch. Second slice of Phase 5; 5a (streaming foundation) is merged, 5c is chat/reactions/moderation/replay.

**Goal:** A ticket-holder can enter an event's live room, be checked in, and watch the Mux Live stream through a signed, ticket-scoped HLS player.

**Architecture:** The `room` route segment gates entry server-side (auth + a valid ticket + a live-ish event). An atomic `attend_check_in` RPC moves the ticket to `IN_ROOM`, closes any prior attendance session, and opens a fresh one. The `streaming` module mints a short-lived **signed Mux playback token** server-side; an `hls.js` client player consumes it. No video URL or signing key ever reaches the client except the scoped token.

**Tech Stack:** Next.js 14, TypeScript (strict), Tailwind, Vitest, plpgsql, `jose` (signed-playback JWT — already a dependency), `hls.js` (already a dependency). Migration applied via the MCP `apply_migration` tool (project ref `jlyqezwuyhfevrdomazd`).

---

## Context for the executor

Phases 1–5a are merged. An event can reach the live-ish states (`SOUNDCHECK`/`DOORS_OPEN`/`LIVE`) and has an `attend_streams` row with a Mux `mux_playback_id`. Buyers hold tickets (`ASSIGNED_TO_BUYER`/`TRANSFER_ACCEPTED`). **There is no event room.**

**Schema (already migrated):**
- `attend_attendance_sessions` — `id, ticket_id (FK), profile_id (FK), event_id (FK), joined_at, left_at, watch_seconds, device, browser, ip_hash, playback_error_count, created_at`.
- `attend_tickets` — `…, owner_id, state (attend_ticket_state), checked_in_at`.
- `attend_streams` — `…, mux_playback_id, status`.
- `attend_event_status` includes `SOUNDCHECK, DOORS_OPEN, LIVE`.
- RPC stubs: none for check-in — a new RPC is added (migration 024).

**Spec basis** — §8.1 (entry gate via the segment's `layout.tsx`, not shared middleware; `CHECKED_IN`/`IN_ROOM` on entry; an attendance session opens), §8.2 (single active session per ticket), §8.3 (signed Mux playback, `hls.js`), §7.9 (ticket transitions).

**Decisions baked into this plan (user-confirmed):**
- **`next.config.mjs` is NOT edited.** Its CSP `connect-src` does not include Mux, so `hls.js` fetches to `stream.mux.com` will be blocked in the browser until the operator adds `https://stream.mux.com` to that directive. The plan builds the full room; the required one-line CSP change is documented in the Notes — applying it is the operator's call.
- **Check-in is webhook-of-its-own:** a new atomic `attend_check_in` RPC. Called by a client-triggered check-in API route on room mount (idempotent — re-entry just opens a new session). Server components do not mutate on render.
- **Signed playback** — the page mints a short-lived signed token server-side via `streamProvider().signPlaybackToken(playbackId)`; the player receives only `{ playbackId, token }`. The Mux signing key never leaves the server.
- **Session close on leave is the `attendance-finalize` job's responsibility** (spec §4.6, Phase 6/7). 5b's check-in closes *prior* open sessions on re-entry (the single-active-session rule); it does not add a leave endpoint.
- **The Realtime "kick the prior device" signal** (spec §8.2) is deferred to 5c with the rest of Supabase Realtime. 5b enforces single-session at the data layer (prior sessions are closed).

## File Structure

**Create:**
- `supabase/migrations/024_attend_check_in.sql` — the `attend_check_in` RPC.
- `src/lib/attend/streaming/attendance-repository.ts` — raw-REST for `attend_attendance_sessions`.
- `src/lib/attend/streaming/room-service.ts` — `getRoomAccess`, `getRoomView`, `checkInToRoom`.
- `src/app/api/attend/events/[id]/check-in/route.ts` — `POST` check-in.
- `src/app/attend/events/[slug]/room/layout.tsx` — the server-side entry gate.
- `src/app/attend/events/[slug]/room/page.tsx` — loads the room view (event, stream, signed token).
- `src/app/attend/events/[slug]/room/room-client.tsx` — the room UI (player + check-in on mount).
- `src/app/attend/events/[slug]/room/mux-player.tsx` — the `hls.js` player.

**Modify:**
- `src/lib/attend/streaming/provider.ts` — add `signPlaybackToken` to `StreamProvider`.
- `src/lib/attend/streaming/fake.ts` and `mux.ts` — implement it.
- `.env.example` — Mux signing-key env vars.

---

## Task 1: Signed playback tokens

**Files:**
- Modify: `src/lib/attend/streaming/provider.ts`, `fake.ts`, `mux.ts`

- [ ] **Step 1: Extend the `StreamProvider` interface** in `provider.ts` — add `signPlaybackToken(playbackId: string): Promise<string>`.

- [ ] **Step 2: `fake.ts`** — `signPlaybackToken` returns a deterministic fake string, e.g. `` `fake-token-${playbackId}` ``.

- [ ] **Step 3: `mux.ts`** — mint a Mux signed-playback JWT with `jose`. Mux signed playback: a JWT with header `{ alg: 'RS256', kid: MUX_SIGNING_KEY_ID }` and payload `{ sub: playbackId, aud: 'v', exp: now + ~2h }`, signed with the RSA private key. The key (`MUX_SIGNING_KEY_PRIVATE`) is supplied base64-encoded — `Buffer.from(key, 'base64').toString('utf8')` yields the PKCS8 PEM; `jose.importPKCS8(pem, 'RS256')` imports it; `new jose.SignJWT({ aud: 'v' }).setProtectedHeader({ alg: 'RS256', kid }).setSubject(playbackId).setExpirationTime('2h').sign(privateKey)`. Throw a clear error if either signing-key env var is missing.

- [ ] **Step 4: Verify** — `npx tsc --noEmit`.
- [ ] **Step 5: Commit** — `feat(attend): add signed Mux playback tokens (Phase 5b task 1)`.

---

## Task 2: The `attend_check_in` RPC

**Files:**
- Create: `supabase/migrations/024_attend_check_in.sql`

- [ ] **Step 1: Write the migration.** Atomic: validate the ticket is owned and room-eligible and the event is live-ish; close any still-open attendance session for the ticket (single-session); open a fresh one; move the ticket to `IN_ROOM`. Structured `{ ok, error? }` return (user-facing failures do not raise).

```sql
-- HYVE Attend — attend_check_in RPC. Atomically enters a ticket-holder into an
-- event room: closes any prior open attendance session (single active session
-- per ticket), opens a fresh one, and moves the ticket to IN_ROOM. This
-- collapses §7.9's CHECKED_IN -> IN_ROOM pair into one atomic step (the
-- session opens as the holder checks in); CHECKED_IN as a resting state is
-- reached only by the leave / attendance-finalize paths in later phases.
create or replace function attend_check_in(p_args jsonb)
returns jsonb language plpgsql as $$
declare
  v_ticket_id    uuid := (p_args->>'ticket_id')::uuid;
  v_profile_id   uuid := (p_args->>'profile_id')::uuid;
  v_device       text := nullif(p_args->>'device', '');
  v_browser      text := nullif(p_args->>'browser', '');
  v_ip_hash      text := nullif(p_args->>'ip_hash', '');
  v_ticket       attend_tickets%rowtype;
  v_event_status attend_event_status;
  v_session_id   uuid;
begin
  select * into v_ticket from attend_tickets where id = v_ticket_id for update;
  if v_ticket.id is null then
    return jsonb_build_object('ok', false, 'error', 'Ticket not found.');
  end if;
  if v_ticket.owner_id is null or v_ticket.owner_id <> v_profile_id then
    return jsonb_build_object('ok', false, 'error', 'This is not your ticket.');
  end if;
  if v_ticket.state not in
     ('ASSIGNED_TO_BUYER', 'TRANSFER_ACCEPTED', 'CHECKED_IN', 'IN_ROOM') then
    return jsonb_build_object('ok', false, 'error', 'This ticket cannot enter the room.');
  end if;

  select status into v_event_status from attend_events where id = v_ticket.event_id;
  if v_event_status not in ('SOUNDCHECK', 'DOORS_OPEN', 'LIVE') then
    return jsonb_build_object('ok', false, 'error', 'The event room is not open yet.');
  end if;

  update attend_attendance_sessions
     set left_at = now(),
         watch_seconds = greatest(0, extract(epoch from now() - joined_at)::int)
   where ticket_id = v_ticket_id and left_at is null;

  insert into attend_attendance_sessions
    (ticket_id, profile_id, event_id, device, browser, ip_hash)
  values (v_ticket_id, v_profile_id, v_ticket.event_id, v_device, v_browser, v_ip_hash)
  returning id into v_session_id;

  update attend_tickets
     set state = 'IN_ROOM', checked_in_at = coalesce(checked_in_at, now()), updated_at = now()
   where id = v_ticket_id;

  return jsonb_build_object('ok', true, 'session_id', v_session_id);
end $$;
```

- [ ] **Step 2: Apply** via the MCP `apply_migration` tool (name `attend_check_in`). Confirm success.
- [ ] **Step 3: Commit** — `feat(attend): implement the attend_check_in RPC (Phase 5b task 2)`.

---

## Task 3: Attendance repository + room service

**Files:**
- Create: `src/lib/attend/streaming/attendance-repository.ts`, `room-service.ts`

- [ ] **Step 1: `attendance-repository.ts`** — query-only raw-REST. `listRoomTicketsForOwner(eventId, ownerId)` → `attend_tickets?event_id=eq.&owner_id=eq.&state=in.(ASSIGNED_TO_BUYER,TRANSFER_ACCEPTED,CHECKED_IN,IN_ROOM)&select=id,state` → the owner's room-eligible tickets for the event.

- [ ] **Step 2: `room-service.ts`** — composes the room. No `import`s from `events/service` beyond the error classes.
  - `LIVE_ROOM_STATUSES = ['SOUNDCHECK', 'DOORS_OPEN', 'LIVE']`.
  - `getRoomAccess(slug, profileId)` → `{ event: EventRow; ticketId: string } | null`. Load the event via `getEventBySlug`; return `null` if missing, soft-deleted, not in a `LIVE_ROOM_STATUSES`, or the profile holds no room-eligible ticket (`listRoomTicketsForOwner` empty). Otherwise return the event + the first eligible ticket id.
  - `getRoomView(slug, profileId)` → `{ event, ticketId, playbackId, playbackToken } | null`. Calls `getRoomAccess`; if null → null. Loads `getEventStream(event.id)`; mints `await streamProvider().signPlaybackToken(stream.mux_playback_id)` when a stream + playback id exist (else `playbackId`/`playbackToken` are null — the room shows "stream not available").
  - `checkInToRoom(eventId, ticketId, profileId, ctx)` → calls the `attend_check_in` RPC via `supaPost`; an `{ ok: false }` result throws `ValidationError(error)`; a non-OK HTTP response throws a generic `Error`. `ctx` carries optional `device`/`browser`/`ip_hash`.

- [ ] **Step 3: Verify** — `npx tsc --noEmit`.
- [ ] **Step 4: Commit** — `feat(attend): add the attendance repository + room service (Phase 5b task 3)`.

---

## Task 4: The check-in API route

**Files:**
- Create: `src/app/api/attend/events/[id]/check-in/route.ts`

- [ ] **Step 1: Build the route.** `runtime = 'nodejs'`. `POST`:
  1. `requireAttendUser()` — `401` if absent.
  2. Resolve the caller's room-eligible ticket for `params.id` via `listRoomTicketsForOwner`; if none → `403 { error: 'You do not have a ticket for this event' }`.
  3. `checkInToRoom(params.id, ticketId, user.id, { ip_hash: <hash of a request ip header>, browser: <ua> })` — derive `ip_hash` with a `crypto` SHA-256 of `x-forwarded-for` (best-effort; null if absent), `browser` from the `user-agent` header.
  4. `200 { ok: true }`. Map `ValidationError → 400`, else log + `500`.

- [ ] **Step 2: Verify** — `npx tsc --noEmit`; `npm run build` lists the route.
- [ ] **Step 3: Commit** — `feat(attend): add the room check-in route (Phase 5b task 4)`.

---

## Task 5: The room route + entry gate

**Files:**
- Create: `src/app/attend/events/[slug]/room/layout.tsx`, `room/page.tsx`

- [ ] **Step 1: `room/layout.tsx`** — the server-side entry gate (spec §8.1 — a server component, not middleware). `export const dynamic = 'force-dynamic'`. `requireAttendUser()`; if null → `redirect('/attend/login')`. `getRoomAccess(params.slug, user.id)`; if null → `redirect('/attend/events/${params.slug}')` (back to the event page — not eligible / event not live). Otherwise render `{children}`. The layout receives `{ params: { slug } }`.

- [ ] **Step 2: `room/page.tsx`** — server component. `getRoomView(params.slug, user.id)` (the gate already passed in the layout, but re-resolve for the data); if null → `notFound()`. Render `<RoomClient eventId={…} eventTitle={…} eventStatus={…} playbackId={…} playbackToken={…} />`.

- [ ] **Step 3: Verify** — `npx tsc --noEmit`; `npm run build` lists `/attend/events/[slug]/room`.
- [ ] **Step 4: Commit** — `feat(attend): add the event-room route + entry gate (Phase 5b task 5)`.

---

## Task 6: The room UI + hls.js player

**Files:**
- Create: `src/app/attend/events/[slug]/room/room-client.tsx`, `room/mux-player.tsx`

- [ ] **Step 1: `mux-player.tsx`** — `'use client'`. Props `{ playbackId: string; playbackToken: string }`. Build the HLS URL `https://stream.mux.com/${playbackId}.m3u8?token=${playbackToken}`. In a `useEffect`: if `videoEl.canPlayType('application/vnd.apple.mpegurl')` (Safari) set `video.src` directly; otherwise dynamically `import('hls.js')`, and if `Hls.isSupported()` attach an `Hls` instance (`hls.loadSource(url); hls.attachMedia(video)`). Clean up the `Hls` instance on unmount. Render a `<video controls playsInline className="aspect-video w-full …">`. Show a small "waiting for the broadcast / connection issue" caption on an `Hls.Events.ERROR` fatal error. Keep it simple — no custom ABR/audio-only toggle (hls.js does adaptive bitrate itself).

- [ ] **Step 2: `room-client.tsx`** — `'use client'`. Props `{ eventId, eventTitle, eventStatus, playbackId, playbackToken }` (the last two nullable). On mount (`useEffect`, once): `POST /api/attend/events/${eventId}/check-in`; track a `checkedIn`/`error` state. Render: the event title + a `LIVE`/status badge; if `playbackId && playbackToken` → `<MuxPlayer>`, else a "The stream is not available yet" panel; a `← Leave room` link to `/attend/events/${slug}`. If check-in fails, show the error (but still render the player — a check-in failure should not blank the room).

- [ ] **Step 3: Verify** — `npx tsc --noEmit`; `npm run build` succeeds.
- [ ] **Step 4: Commit** — `feat(attend): add the room UI + hls.js player (Phase 5b task 6)`.

---

## Task 7: Env documentation + whole-phase verification

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: `.env.example`** — extend the Mux block with `MUX_SIGNING_KEY_ID` and `MUX_SIGNING_KEY_PRIVATE` (the base64 signing key from Mux Dashboard → Settings → Signing Keys), with a one-line note they are needed for signed playback.

- [ ] **Step 2: Whole-phase verification** — `npx tsc --noEmit` clean; `npm test` green (no regressions; 5b adds no unit test — the room flow is I/O-bound, integration tests are deferred to Phase 7); `npm run build` succeeds, lists `/attend/events/[slug]/room` and `/api/attend/events/[id]/check-in`, no existing route broken.
- [ ] **Step 3: Commit** — `chore(attend): document Mux signing-key env vars (Phase 5b task 7)`.

---

## Verification checklist (whole phase)

- [ ] `npx tsc --noEmit` clean; `npm test` green; `npm run build` succeeds and lists the two new routes.
- [ ] Migration 024 applied to Supabase.
- [ ] Entry is gated server-side (`room/layout.tsx`) — auth + a room-eligible ticket + a live-ish event; no shared middleware touched.
- [ ] `attend_check_in` is atomic, idempotent on re-entry, and enforces single active session per ticket.
- [ ] The Mux signing key never reaches the client — only the short-lived scoped token does.
- [ ] No new dependency; **`next.config.mjs` untouched**; the only shared-file edit is `.env.example`.

## Notes & deferrals

- **Operator action — CSP (required for video on most browsers):** the site CSP's `connect-src` (`next.config.mjs` ~line 60) does not include Mux. `hls.js` (Chrome / Firefox / Edge — the majority of users) fetches the HLS manifest and segments via `fetch`/XHR, which `connect-src` governs — so **video will not play on those browsers** until `https://stream.mux.com` is added to `connect-src`. Safari's native HLS plays through the `<video>` element (governed by `media-src`, which already allows `https:`) and is unaffected. The player degrades gracefully on the blocked fetch (an `Hls.Events.ERROR` caption, not a crash). This one-line CSP edit was left to the operator by explicit decision; nothing else in `next.config.mjs` changes.
- **5c** adds chat + reactions over Supabase Realtime, the energy meter, moderation, the Realtime "single device" kick signal, `attend_stream_health_metrics`, and replay.
- **Show-day transitions** (`ON_SALE → SOUNDCHECK → DOORS_OPEN → LIVE → ENDED`) and the `attendance-finalize` job (which closes open sessions and sets `USED`/`NO_SHOW`) land with 5c / Phase 6–7. Until then a room is reachable only once an admin/test path puts the event in a live-ish state.
- **Mux signed playback** requires a Mux signing key (`MUX_SIGNING_KEY_ID` / `MUX_SIGNING_KEY_PRIVATE`) in addition to the Phase 5a API token; without them the fake provider is used.
