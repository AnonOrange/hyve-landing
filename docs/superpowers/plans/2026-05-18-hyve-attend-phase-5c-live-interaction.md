# HYVE Attend — Phase 5c: Live Interaction Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax. Executed in-session against the `attend-phase-5c-live-interaction` branch. Third slice of Phase 5.

**Goal:** A show can go live and end (creator + Mux webhook), and attendees in the room can chat and react in real time, with a reaction-driven energy meter.

**Architecture:** Show-day transitions are guarded `attend_events` status changes — creator-driven (`SOUNDCHECK`, `DOORS_OPEN`, end-show) and Mux-webhook-driven (`DOORS_OPEN→LIVE`, `LIVE→ENDED`). Chat/reactions are written server-side to `attend_chat_messages` / `attend_reaction_events` (the durable record) and delivered live by **Supabase Realtime Broadcast** on a per-event channel — no RLS policies, consistent with the service-key architecture.

**Tech Stack:** Next.js 14, TypeScript (strict), Tailwind, Vitest, `@supabase/ssr` (browser client — already present), `@supabase/supabase-js` Realtime (already present).

---

## Context for the executor

Phases 1–5b are merged. An event reaches `STREAM_SETUP_REQUIRED → SUBMITTED_FOR_REVIEW`; an event in `SOUNDCHECK`/`DOORS_OPEN`/`LIVE` has a working room (5b). **But nothing moves an event into those live-ish states** — the room is currently unreachable in practice. And the room has video only — no chat/reactions.

**Schema (already migrated):**
- `attend_chat_messages` — `id, event_id (FK), profile_id (FK), body, moderation_state ('VISIBLE'/'HIDDEN'/'DELETED', default VISIBLE), created_at`.
- `attend_reaction_events` — `id, event_id (FK), profile_id (FK), kind, created_at`.
- `attend_event_status` includes `SOUNDCHECK, DOORS_OPEN, LIVE, ENDED`.
- RLS is enabled on every table with **zero policies** (service-key access only).

**Spec basis** — §6.9 (show-day transitions: `ON_SALE/SALES_PAUSED→SOUNDCHECK`, `SOUNDCHECK→DOORS_OPEN` creator-driven; `DOORS_OPEN→LIVE`, `LIVE→ENDED` Mux-webhook-driven; `LIVE→ENDED` also creator), §8.4 (chat + reactions over Realtime, an energy/applause meter).

**Existing pieces to reuse:**
- `events/service.ts` — `changeEventStatus(id, creatorId, to)` does an ownership-checked, `assertTransition`-guarded status change; `events/[id]/route.ts` is action-based.
- `streaming/streaming-service.ts` — `applyMuxStreamEvent` is extended to also drive the event status.
- `streaming/room-service.ts` — `getRoomView` returns the room's `eventId`.
- `identity/supabase-browser.ts` — `attendBrowserClient()` (anon-key browser client; used here for the Realtime channel).
- `room/room-client.tsx` — gains the chat/reactions panel.

**Decisions baked into this plan:**
- **Realtime Broadcast, not `postgres_changes`.** A chat message: client `POST`s it → the API route inserts the `attend_chat_messages` row (service key) **and** broadcasts it via the Supabase Realtime broadcast REST endpoint. Clients only *receive* broadcasts (server-authoritative — no client-forged messages). On room load the client fetches recent history via an API route. Same for reactions.
- **The broadcast channel** is `attend-room-${eventId}`. It is open (anon clients can subscribe). The room itself is gated server-side (5b); the chat channel is a convenience layer and carries no secrets.
- **System-driven event transitions** (the Mux webhook moving an event `DOORS_OPEN→LIVE`/`LIVE→ENDED`) use new `events/service.ts` functions with **no ownership check** — `changeEventStatus` cannot be reused there (it asserts creator ownership).
- **Deferred to a Phase 5 follow-on / Phase 7:** moderation (`attend_moderation_actions`), `attend_stream_health_metrics` ingestion, replay, and the §8.2 Realtime "single-device kick" (the data-layer single-session is already enforced by 5b's check-in RPC).

## File Structure

**Create:**
- `src/lib/attend/live/broadcast.ts` — `broadcastToRoom(eventId, event, payload)` via the Realtime REST endpoint.
- `src/lib/attend/live/energy.ts` + `energy.test.ts` — pure reaction→meter level.
- `src/lib/attend/live/chat-repository.ts`, `reaction-repository.ts` — raw-REST.
- `src/lib/attend/live/chat-service.ts`, `reaction-service.ts`.
- `src/app/api/attend/events/[id]/chat/route.ts` — `GET` recent + `POST` a message.
- `src/app/api/attend/events/[id]/reactions/route.ts` — `POST` a reaction.
- `src/app/attend/events/[slug]/room/live-panel.tsx` — the chat + reactions client UI.

**Modify:**
- `src/lib/attend/events/service.ts` — add `markEventLive`, `markEventEnded` (system transitions).
- `src/app/api/attend/events/[id]/route.ts` — add `start-soundcheck`, `open-doors`, `end-show` actions.
- `src/lib/attend/streaming/streaming-service.ts` — `applyMuxStreamEvent` also drives `DOORS_OPEN→LIVE` / `LIVE→ENDED`.
- `src/app/attend/(creator)/creator/events/[id]/event-dashboard-client.tsx` — creator show-day controls.
- `src/app/attend/events/[slug]/room/room-client.tsx` — render `<LivePanel>`.

---

## Task 1: Show-day transitions

**Files:**
- Modify: `src/lib/attend/events/service.ts`, `src/app/api/attend/events/[id]/route.ts`, `src/lib/attend/streaming/streaming-service.ts`

- [ ] **Step 1: `events/service.ts`** — add system transitions (no ownership check; driven by the Mux webhook):

```ts
/** System-driven: a DOORS_OPEN event whose Mux stream went active goes LIVE. */
export async function markEventLive(eventId: string): Promise<void> {
  const event = await getEventById(eventId)
  if (!event || event.status !== 'DOORS_OPEN') return
  assertTransition(event.status, 'LIVE')
  await updateEvent(eventId, { status: 'LIVE', updated_by: 'system' })
}

/** System-driven: a LIVE event whose Mux stream ended goes ENDED. */
export async function markEventEnded(eventId: string): Promise<void> {
  const event = await getEventById(eventId)
  if (!event || event.status !== 'LIVE') return
  assertTransition(event.status, 'ENDED')
  await updateEvent(eventId, { status: 'ENDED', updated_by: 'system' })
}
```

(Both are no-ops if the event is not in the expected state — safe under webhook retries.)

- [ ] **Step 2: `events/[id]/route.ts` show-day actions** — add three creator actions before `cancel`, each a guarded `changeEventStatus`:

```ts
    if (body.action === 'start-soundcheck') {
      await changeEventStatus(params.id, profile.id, 'SOUNDCHECK')
      return NextResponse.json({ ok: true, status: 'SOUNDCHECK' })
    }
    if (body.action === 'open-doors') {
      await changeEventStatus(params.id, profile.id, 'DOORS_OPEN')
      return NextResponse.json({ ok: true, status: 'DOORS_OPEN' })
    }
    if (body.action === 'end-show') {
      await changeEventStatus(params.id, profile.id, 'ENDED')
      return NextResponse.json({ ok: true, status: 'ENDED' })
    }
```

`changeEventStatus` already `assertTransition`s — an illegal jump (e.g. `open-doors` on a `DRAFT`) becomes a `ValidationError → 400`.

- [ ] **Step 3: `streaming-service.ts`** — `applyMuxStreamEvent` drives the event status. After updating `attend_streams`: on `video.live_stream.active` call `markEventLive(stream.event_id)`; on `video.live_stream.idle` call `markEventEnded(stream.event_id)`. Import both from `events/service`. **`video.live_stream.disconnected` must NOT end the show** — it is a transient state inside Mux's `reconnect_window` (the encoder may reconnect), and `ENDED` is irreversible; `disconnected` only updates `attend_streams.status` to `DISCONNECTED` as Phase 5a already does. Only `idle` (the definitive end of the stream) ends the event. `markEventLive`/`markEventEnded` are guarded no-ops, so a stream signal before the creator opens doors does nothing.

- [ ] **Step 4: Verify** — `npx tsc --noEmit`; `npm test` green.
- [ ] **Step 5: Commit** — `feat(attend): add show-day event transitions (Phase 5c task 1)`.

---

## Task 2: Creator show-day controls

**Files:**
- Modify: `src/app/attend/(creator)/creator/events/[id]/event-dashboard-client.tsx`

- [ ] **Step 1: Extend `nextStep()`** with the show-day states (all use the existing `patchAction` helper):
  - `ON_SALE` / `SALES_PAUSED` → "Start the show-day soundcheck" → `patchAction('start-soundcheck')`.
  - `SOUNDCHECK` → "Open the doors" → `patchAction('open-doors')`; also show the room link `/attend/events/${event.slug}/room`.
  - `DOORS_OPEN` → body "Doors are open — go live in your broadcast software; the show moves to LIVE automatically when Mux detects the stream." No primary button (webhook-driven), plus a disabled-styled note; show the room link.
  - `LIVE` → "End the show" → `patchAction('end-show')`; show the room link.
  - `ENDED`/later → a short status line.
  Keep the existing `wrap()`/section styling.

- [ ] **Step 2: Verify** — `npx tsc --noEmit`; `npm run build` succeeds.
- [ ] **Step 3: Commit** — `feat(attend): add creator show-day controls (Phase 5c task 2)`.

---

## Task 3: Live foundation — broadcast, energy meter, repositories

**Files:**
- Create: `src/lib/attend/live/broadcast.ts`, `energy.ts`, `energy.test.ts`, `chat-repository.ts`, `reaction-repository.ts`

- [ ] **Step 1: `broadcast.ts`** — `broadcastToRoom(eventId, event, payload)`: `POST ${SUPABASE_URL}/realtime/v1/api/broadcast` with headers `apikey` + `Authorization: Bearer ${SUPABASE_SERVICE_KEY}` + JSON, body `{ messages: [{ topic: `attend-room-${eventId}`, event, payload }] }`. Log + swallow a non-OK response (a failed broadcast must not fail the message POST — the durable row is already written; clients reconcile on reload).

- [ ] **Step 2: Write the failing test** — `energy.test.ts`. `energyLevel(reactionCountInWindow)` maps a recent-reaction count to a 0–100 meter level. Assert: `0 → 0`; the level rises monotonically with the count; it clamps at `100` for large counts; e.g. a mid count gives a mid value.

- [ ] **Step 3: Run, expect FAIL.**

- [ ] **Step 4: `energy.ts`** — pure `energyLevel(count: number): number`. A simple saturating curve, e.g. `Math.min(100, Math.round(count * <factor>))` for a chosen factor (pick so ~20 reactions in the window ≈ 100). Document the window assumption in a comment.

- [ ] **Step 5: Run, expect PASS.**

- [ ] **Step 6: `chat-repository.ts`** — `ChatMessageRow` type; `insertChatMessage({ event_id, profile_id, body })` → row; `listRecentChatMessages(eventId, limit=50)` → `VISIBLE` messages, newest-last, with the sender's `display_name` embedded (`select=*,attend_profiles(display_name)`). `reaction-repository.ts` — `insertReaction({ event_id, profile_id, kind })` → row.

- [ ] **Step 7: Verify** — `npx tsc --noEmit`; `npm test` green.
- [ ] **Step 8: Commit** — `feat(attend): add the live broadcast helper, energy meter, chat/reaction repositories (Phase 5c task 3)`.

---

## Task 4: Chat + reaction services and API routes

**Files:**
- Create: `src/lib/attend/live/chat-service.ts`, `reaction-service.ts`, `src/app/api/attend/events/[id]/chat/route.ts`, `src/app/api/attend/events/[id]/reactions/route.ts`

- [ ] **Step 1: `chat-service.ts`** — `postChatMessage(eventId, profileId, displayName, body)`: validate `body` is non-empty and ≤ a sane length (e.g. 500 chars; `ValidationError` otherwise); `insertChatMessage`; then `broadcastToRoom(eventId, 'chat', { id, profileId, displayName, body, createdAt })`; return the message. `getRecentChat(eventId)` → `listRecentChatMessages`.

- [ ] **Step 2: `reaction-service.ts`** — `postReaction(eventId, profileId, kind)`: validate `kind` against a small allowed set (e.g. `CLAP`, `FIRE`, `HEART`, `WOW`); `insertReaction`; `broadcastToRoom(eventId, 'reaction', { kind })`; return ok. There is **no** server-side energy endpoint — the meter is computed client-side in `live-panel.tsx` from the `reaction` broadcasts it receives, via the pure `energyLevel`.

- [ ] **Step 3: `chat/route.ts`** — `GET` → `requireAttendUser`, return `{ messages: await getRecentChat(params.id) }`. `POST` → `requireAttendUser` + `ensureProfile`; resolve the display name; `postChatMessage(...)`; `200 { ok: true }`. Map `ValidationError → 400`. Note: room membership is not re-checked per-message — the room gate (5b) governs entry; a bare API caller can post to an event's chat, acceptable for the MVP (messages are attributed and moderatable).

- [ ] **Step 4: `reactions/route.ts`** — `POST` → `requireAttendUser`; `postReaction(...)`; `200 { ok: true }`. Body `{ kind }`.

- [ ] **Step 5: Verify** — `npx tsc --noEmit`; `npm run build` lists the routes.
- [ ] **Step 6: Commit** — `feat(attend): add the chat + reaction services and routes (Phase 5c task 4)`.

---

## Task 5: The room live panel

**Files:**
- Create: `src/app/attend/events/[slug]/room/live-panel.tsx`
- Modify: `src/app/attend/events/[slug]/room/room-client.tsx`

- [ ] **Step 1: `live-panel.tsx`** — `'use client'`. Props `{ eventId: string }`.
  - On mount: `GET /api/attend/events/${eventId}/chat` for the recent backlog into a `messages` state.
  - Subscribe to the Realtime channel `attend-room-${eventId}` via `attendBrowserClient().channel(...)`: `.on('broadcast', { event: 'chat' }, …)` appends a message; `.on('broadcast', { event: 'reaction' }, …)` increments an in-memory recent-reaction counter that feeds the energy meter (decay the counter on a short interval so it falls when reactions stop). `.subscribe()`. Clean up the channel on unmount.
  - Render: a scrolling message list (sender name + body); a text input + send (`POST …/chat`); a row of reaction buttons (`POST …/reactions`); an energy meter bar driven by the local reaction counter via `energyLevel`.
  - Reuse the dark palette; keep it compact (it sits beside the video).

- [ ] **Step 2: `room-client.tsx`** — render `<LivePanel eventId={eventId} />` beside/below the player (a responsive two-column layout: player + live panel).

- [ ] **Step 3: Verify** — `npx tsc --noEmit`; `npm test` green; `npm run build` succeeds; no existing route changed.
- [ ] **Step 4: Commit** — `feat(attend): add the room chat + reactions panel (Phase 5c task 5)`.

---

## Verification checklist (whole phase)

- [ ] `npx tsc --noEmit` clean; `npm test` green (incl. new `energyLevel` tests); `npm run build` succeeds, lists the chat + reactions routes.
- [ ] No migration this phase (the chat/reaction tables already exist); no new dependency; no shared-file edits.
- [ ] Chat/reactions are written to the DB server-side (durable, moderatable) and delivered live by broadcast — no RLS policy added, no `postgres_changes`.
- [ ] Show-day transitions: creator drives `SOUNDCHECK`/`DOORS_OPEN`/end-show; the Mux webhook drives `DOORS_OPEN→LIVE` and `LIVE→ENDED`, each a guarded no-op when the event is not in the expected state.
- [ ] The room is now reachable end-to-end: creator opens doors → attendees enter → the show goes LIVE on the Mux signal → chat + reactions work.

## Notes & deferrals

- **Realtime Broadcast** needs no RLS; the channel `attend-room-${eventId}` is open (public). The durable `attend_chat_messages` rows remain the moderation/evidence record.
- **Broadcast round-trip needs manual verification.** The live chat/reaction delivery cannot be exercised by the build or the test suite — it needs Supabase Realtime and two browsers. Verify post-merge: open one room in two browsers, send a chat message, confirm it appears in the other. The Supabase project's Realtime settings should be at their defaults (public-channel broadcast enabled). The server-side broadcast REST endpoint returns `202` on success — treated as OK (`res.ok`).
- **Deferred (a Phase 5 follow-on / Phase 7):** moderation (`attend_moderation_actions` — hide/mute/ban; the chat already only renders `VISIBLE` messages, so hiding works once the action exists), `attend_stream_health_metrics` ingestion + attendee error reports, replay playback (`replay_available`), and the §8.2 Realtime single-device kick (5b's check-in RPC already enforces one open session at the data layer).
- **Operator note (still pending):** the `next.config.mjs` CSP `connect-src` needs `https://stream.mux.com` for non-Safari video; it also already allows `wss://*.supabase.co`, so the Realtime websocket for chat is **not** blocked.
