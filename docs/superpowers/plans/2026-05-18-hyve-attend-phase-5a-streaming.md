# HYVE Attend — Phase 5a: Streaming Foundation + Creator Stream Setup Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax. Executed in-session against the `attend-phase-5a-streaming` branch. First slice of Phase 5 (live experience); 5b is the event room, 5c is chat/moderation/replay.

**Goal:** A creator can provision a Mux Live stream for an event, see its RTMP ingest details, have a successful test run recorded, and submit the event for review.

**Architecture:** A `StreamProvider` interface abstracts Mux Live, with a real `fetch`-based Mux implementation and a deterministic fake — so the build and test suite run offline; the real path activates when `MUX_TOKEN_ID` is set (the established Stripe/cron-secret pattern). A `streaming` module owns `attend_streams`. The Mux webhook keeps `attend_streams` in sync and records the stream test. The creator dashboard's `STREAM_SETUP_REQUIRED` step becomes real, ending in the `STREAM_SETUP_REQUIRED → SUBMITTED_FOR_REVIEW` transition.

**Tech Stack:** Next.js 14, TypeScript (strict), Tailwind, Vitest. The real Mux impl uses `fetch` + `crypto` (HMAC webhook verification) — **no new dependency** (`@mux/mux-node` is not needed; signed-playback JWTs come in 5b via the already-present `jose`).

---

## Context for the executor

Phases 1–4 are merged. An event walks the setup chain to `STREAM_SETUP_REQUIRED`, where the creator dashboard currently shows a disabled "Stream setup — coming soon" next-step (`event-dashboard-client.tsx`, the `STREAM_SETUP_REQUIRED` case of `nextStep()`).

**Schema (already migrated):**
- `attend_streams` — `id, event_id (FK, unique), provider ('mux'), mux_stream_id, mux_playback_id, stream_key, rtmp_url, status (attend_stream_status: IDLE/TESTING/ACTIVE/DISCONNECTED/ENDED), test_passed_at, recording_asset_id, started_at, ended_at`.
- `attend_webhook_events` — the exactly-once dedup table; `provider` accepts `STRIPE` and `MUX`.
- `attend_events.status` — `STREAM_SETUP_REQUIRED → SUBMITTED_FOR_REVIEW` is already a legal transition in `lifecycle.ts`.

**Spec basis** — §4.5 (`StreamProvider` boundary), §6 step 4 (`STREAM_SETUP_REQUIRED`), §6.9 (the submit transition, guard "`test_passed_at` set or admin override"), §8.

**Existing pieces to reuse:**
- `payments/payments-repository.ts` — `claimWebhookEvent(provider, …)`, `isWebhookProcessed`, `releaseWebhookClaim`, `markWebhookProcessed` are provider-generic; the Mux webhook reuses them with `provider = 'MUX'`. (They live in `payments-repository` for historical reasons — importing them from there is acceptable; do not move merged code.)
- `app/api/attend/webhooks/stripe/route.ts` — the exactly-once claim flow to mirror.
- `events/service.ts` — `loadOwned` (private), `advanceSetup(id, creatorId, payoutsAreEnabled)` is the template for `submitForReview` (the route supplies the external fact).
- `events/[id]/route.ts` — the action-based PATCH (`advance-setup`, `start-setup`, `cancel`).
- `attend_streams` is created by the `streaming` module only — no RPC needed; the writes are single-table.

**Decisions baked into this plan:**
- **No new dependency.** The Mux impl calls the Mux REST API with `fetch` + HTTP Basic auth and verifies webhooks with `crypto` HMAC. `@mux/mux-node` is not added.
- **`next.config.mjs` is NOT touched.** HLS playback CSP is a 5b concern; if a CSP change is needed there it will be flagged for explicit approval (spec §13). 5a renders no video.
- **The stream test** = the first time the Mux stream goes `active`, the webhook records `attend_streams.test_passed_at`. No polling.
- **Signed playback** — the Mux live stream is created with `playback_policy: ['signed']` so only ticket-holders (issued a signed token in 5b) can watch. 5a stores the `playback_id`; token minting is 5b.
- A missing `MUX_TOKEN_ID`/`MUX_TOKEN_SECRET` selects the **fake** provider — the creator flow is fully exerciseable in dev; production needs the real Mux credentials.

## File Structure

**Create:**
- `src/lib/attend/streaming/provider.ts` — the `StreamProvider` interface, `LiveStream` type, `streamProvider()` selector.
- `src/lib/attend/streaming/fake.ts` — `FakeStreamProvider`.
- `src/lib/attend/streaming/mux.ts` — `MuxStreamProvider` (fetch-based).
- `src/lib/attend/streaming/stream-repository.ts` — raw-REST for `attend_streams`.
- `src/lib/attend/streaming/streaming-service.ts` — `createEventStream`, `getEventStream`, `applyMuxStreamEvent`.
- `src/app/api/attend/events/[id]/stream/route.ts` — `POST` to provision the stream.
- `src/app/api/attend/webhooks/mux/route.ts` — the Mux webhook.

**Modify:**
- `src/lib/attend/events/service.ts` — add `submitForReview`.
- `src/app/api/attend/events/[id]/route.ts` — add the `submit-for-review` PATCH action.
- `src/app/attend/(creator)/creator/events/[id]/page.tsx` — load the event's stream.
- `src/app/attend/(creator)/creator/events/[id]/event-dashboard-client.tsx` — the real `STREAM_SETUP_REQUIRED` UI.
- `.env.example` — Mux env vars.

---

## Task 1: The `StreamProvider` abstraction

**Files:**
- Create: `src/lib/attend/streaming/provider.ts`, `fake.ts`, `mux.ts`

- [ ] **Step 1: `provider.ts`** — the interface + selector:

```ts
export interface LiveStream {
  streamId: string      // Mux live stream id
  playbackId: string    // Mux playback id (HLS, signed policy)
  streamKey: string     // RTMP stream key (secret)
  rtmpUrl: string       // RTMP ingest URL
}

export interface StreamProvider {
  createLiveStream(): Promise<LiveStream>
  // Verify a provider webhook's signature over the raw body.
  verifyWebhookSignature(rawBody: string, signature: string | null): boolean
}
```

`streamProvider()` returns `new MuxStreamProvider()` when `process.env.MUX_TOKEN_ID && process.env.MUX_TOKEN_SECRET` are set, otherwise `new FakeStreamProvider()`. Lazy `import`/construction is fine; mirror `attendStripe()`'s shape.

- [ ] **Step 2: `fake.ts`** — `FakeStreamProvider implements StreamProvider`. `createLiveStream()` returns deterministic-shaped fake values (`fake-stream-<random hex>`, `fake-playback-…`, `fake-key-…`, `rtmp://fake.local/app`). `verifyWebhookSignature()` returns `true` (dev/CI).

- [ ] **Step 3: `mux.ts`** — `MuxStreamProvider implements StreamProvider`.
  - `createLiveStream()`: `POST https://api.mux.com/video/v1/live-streams` with `Authorization: Basic base64(MUX_TOKEN_ID:MUX_TOKEN_SECRET)`, body `{ playback_policy: ['signed'], new_asset_settings: { playback_policy: ['signed'] }, latency_mode: 'low', reconnect_window: 60 }`. From the response `data`, return `{ streamId: data.id, playbackId: data.playback_ids[0].id, streamKey: data.stream_key, rtmpUrl: 'rtmps://global-live.mux.com:443/app' }`. Throw on a non-2xx response.
  - `verifyWebhookSignature(rawBody, signature)`: Mux sends `Mux-Signature: t=<ts>,v1=<hex hmac>`. Parse `t` and `v1`; compute `HMAC-SHA256(MUX_WEBHOOK_SECRET, `${t}.${rawBody}`)`; constant-time compare against `v1`. Return `false` on any parse failure or if `MUX_WEBHOOK_SECRET` is unset.

- [ ] **Step 4: Verify** — `npx tsc --noEmit`.
- [ ] **Step 5: Commit** — `feat(attend): add the StreamProvider abstraction (Phase 5a task 1)`.

---

## Task 2: Stream repository + streaming service

**Files:**
- Create: `src/lib/attend/streaming/stream-repository.ts`, `streaming-service.ts`

- [ ] **Step 1: `stream-repository.ts`** — raw-REST for `attend_streams`, query-only. `StreamRow` (all columns). `getStreamByEventId(eventId)` → row|null; `getStreamByMuxId(muxStreamId)` → row|null; `insertStream(NewStreamRow)` → row; `updateStream(id, patch)`.

- [ ] **Step 2: `streaming-service.ts`:**
  - `createEventStream(eventId, creatorId)` — load the event (`getEventById`); `NotFoundError` if missing, `ForbiddenError` if `creator_id !== creatorId`, `ValidationError` if `status !== 'STREAM_SETUP_REQUIRED'`. If a stream row already exists for the event, return it (idempotent — do not create a second Mux stream). Otherwise `streamProvider().createLiveStream()`, insert the `attend_streams` row (`provider: 'mux'`, the four ids/urls, `status: 'IDLE'`), return it.
  - `getEventStream(eventId)` → `StreamRow | null`.
  - `applyMuxStreamEvent(muxStreamId, eventType)` — called by the webhook. `getStreamByMuxId`; if none, no-op (a stream we do not track). Map the event: `video.live_stream.active` → `status: 'ACTIVE'`, set `started_at` if unset, **and set `test_passed_at` if currently null** (the first active run is the test); `video.live_stream.idle` → `status: 'IDLE'`; `video.live_stream.disconnected` → `status: 'DISCONNECTED'`. Other event types → no-op. Patch via `updateStream`.

- [ ] **Step 3: Verify** — `npx tsc --noEmit`.
- [ ] **Step 4: Commit** — `feat(attend): add the streaming repository + service (Phase 5a task 2)`.

---

## Task 3: `submitForReview` + creator routes

**Files:**
- Modify: `src/lib/attend/events/service.ts`, `src/app/api/attend/events/[id]/route.ts`
- Create: `src/app/api/attend/events/[id]/stream/route.ts`

- [ ] **Step 1: `submitForReview` in `events/service.ts`** — mirrors `advanceSetup` (the route supplies the external fact):

```ts
/** Submit a STREAM_SETUP_REQUIRED event for review. `streamTestPassed` is
 *  supplied by the route (attend_streams.test_passed_at is non-null). */
export async function submitForReview(
  id: string,
  creatorId: string,
  streamTestPassed: boolean,
): Promise<void> {
  const event = await loadOwned(id, creatorId)
  if (event.status !== 'STREAM_SETUP_REQUIRED') {
    throw new ValidationError('This event is not ready to submit for review')
  }
  if (!streamTestPassed) {
    throw new ValidationError('Run a successful stream test before submitting for review')
  }
  assertTransition(event.status, 'SUBMITTED_FOR_REVIEW')
  await updateEvent(id, { status: 'SUBMITTED_FOR_REVIEW', updated_by: creatorId })
}
```

- [ ] **Step 2: `submit-for-review` action** in `events/[id]/route.ts` PATCH. Import `submitForReview` and `getEventStream` (from `streaming/streaming-service`). Add before the `cancel` branch:

```ts
    if (body.action === 'submit-for-review') {
      const stream = await getEventStream(params.id)
      await submitForReview(params.id, profile.id, stream?.test_passed_at != null)
      return NextResponse.json({ ok: true, status: 'SUBMITTED_FOR_REVIEW' })
    }
```

- [ ] **Step 3: `events/[id]/stream/route.ts`** — `POST`, `runtime = 'nodejs'`. `requireCreator()` (401 if absent). `createEventStream(params.id, profile.id)` → `200` with `{ streamKey, rtmpUrl }` (and a flag). Map `ValidationError → 400`, `ForbiddenError → 403`, `NotFoundError → 404`, else log + 500.

- [ ] **Step 4: Verify** — `npx tsc --noEmit`; `npm run build` lists the route.
- [ ] **Step 5: Commit** — `feat(attend): add stream provisioning + submit-for-review (Phase 5a task 3)`.

---

## Task 4: The Mux webhook

**Files:**
- Create: `src/app/api/attend/webhooks/mux/route.ts`

- [ ] **Step 1: Build the webhook** — mirror `webhooks/stripe/route.ts`'s exactly-once claim flow. `runtime = 'nodejs'`. `POST`:
  1. Read the raw body; `verifyWebhookSignature(rawBody, req.headers.get('mux-signature'))` via `streamProvider()`. On failure → `400`.
  2. Parse the event envelope `{ id, type, data }`. **Dedup on the envelope `id`** — that is the unique *event* id. Do NOT dedup on `data.id`: that is the live-stream *object* id, which repeats across every `active`/`idle`/`disconnected` event for the same stream — deduping on it would 200-duplicate every event after the first, and the stream would never update again.
  3. `claimWebhookEvent('MUX', event.id, event.type, event)` — the Phase 2b atomic claim; pass the full parsed event as the `payload`. If not claimed: `isWebhookProcessed` → 200 duplicate, else 500 (retry).
  4. In the handler: if `event.type` starts with `video.live_stream.`, `await applyMuxStreamEvent(event.data.id, event.type)` — passing the live-stream *object* id. `markWebhookProcessed`; return `200 { received: true }`. On a handler throw: `releaseWebhookClaim` + 500.

- [ ] **Step 2: Verify** — `npx tsc --noEmit`; `npm run build` lists `/api/attend/webhooks/mux`.
- [ ] **Step 3: Commit** — `feat(attend): add the Mux webhook (Phase 5a task 4)`.

---

## Task 5: Creator stream-setup UI

**Files:**
- Modify: `src/app/attend/(creator)/creator/events/[id]/page.tsx`, `event-dashboard-client.tsx`

- [ ] **Step 1: `page.tsx`** — also load the stream: `getEventStream(event.id)` (alongside the existing event/ticketTypes/payouts loads); pass `stream` to `<EventDashboardClient>`.

- [ ] **Step 2: `event-dashboard-client.tsx`** — accept a `stream` prop (`StreamRow | null`). Replace the `STREAM_SETUP_REQUIRED` case of `nextStep()`:
  - **No stream yet** (`stream` is null): heading "Set up your live stream", body explaining Mux ingest, a **"Create stream"** button → `POST /api/attend/events/${id}/stream`; on success reload.
  - **Stream exists, `test_passed_at` null**: show the **RTMP ingest URL** and **stream key** (the key in a monospace box, with a note it is secret) for the creator's broadcast software; body: "Go live from your software once to run the test, then reload this page to see it pass." No primary button yet (the test is webhook-driven). A disabled "Submit for review" with "complete the stream test first".
  - **Stream exists, `test_passed_at` set**: "Stream test passed ✓"; a **"Submit for review"** button → `PATCH { action: 'submit-for-review' }`; on success reload.
  - Reuse the existing `nextStep()` card styling and the dashboard's `patchAction`/`redirectTo` helpers; add a small stream-create call (a `POST` returning no URL — reload on `ok`).

- [ ] **Step 3: Verify** — `npx tsc --noEmit`; `npm run build` succeeds.
- [ ] **Step 4: Commit** — `feat(attend): add the creator stream-setup UI (Phase 5a task 5)`.

---

## Task 6: Env documentation + whole-phase verification

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: `.env.example`** — add a HYVE Attend Mux block: `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET` (the API access token — Mux Dashboard → Settings → Access Tokens), and `MUX_WEBHOOK_SECRET` (the signing secret of the `/api/attend/webhooks/mux` endpoint). One-line comments; note that without them the fake provider is used.

- [ ] **Step 2: Whole-phase verification** — `npx tsc --noEmit` clean; `npm test` green (no test regressions; 5a adds no unit test — the `StreamProvider` fake exists for the 5b/5c integration tests deferred to Phase 7); `npm run build` succeeds, lists `/api/attend/events/[id]/stream` and `/api/attend/webhooks/mux`, no existing route broken.
- [ ] **Step 3: Commit** — `chore(attend): document Mux env vars (Phase 5a task 6)`.

---

## Verification checklist (whole phase)

- [ ] `npx tsc --noEmit` clean; `npm test` green; `npm run build` succeeds and lists the two new routes.
- [ ] No new dependency added; `next.config.mjs` untouched; the only shared-file edit is `.env.example`.
- [ ] With no Mux env vars, `streamProvider()` returns the fake and the creator stream-setup flow still works end to end in dev.
- [ ] The Mux webhook is signature-verified and exactly-once (the Phase 2b claim machinery, `provider = 'MUX'`).
- [ ] `createEventStream` is idempotent — a second call returns the existing stream, never a second Mux stream.

## Notes & deferrals

- **5b (event room)** adds signed Mux playback-token minting (`jose`), the `hls.js` player, the room entry gate + check-in, and attendance sessions — and is where the `next.config.mjs` CSP question will be raised for explicit approval.
- **5c** adds chat/reactions over Realtime, moderation, `attend_stream_health_metrics` ingestion, and replay (`replay-processing`).
- **Show-day transitions** (`ON_SALE → SOUNDCHECK → DOORS_OPEN → LIVE → ENDED`) are 5b/5c — the 5a Mux webhook keeps `attend_streams` in sync but does not drive `attend_events.status`.
- **Phase 7 hardening — composite webhook-events key:** `attend_webhook_events` has a global `unique(provider_event_id)`; now that a second provider (MUX) writes to it, tighten the constraint to `unique(provider, provider_event_id)` and add `provider` to the four `payments-repository` webhook-event query filters. Harmless today (Stripe `evt_…` and Mux UUID event ids cannot collide) — correct it before launch.
- **5b/5c note:** `applyMuxStreamEvent` does not clear `attend_streams.ended_at` on a re-`active` event. 5a never sets `ended_at`, so this is dormant — the 5b/5c handler that sets `ended_at` on stream end must also clear it on a later reconnect.
- **Mux provisioning is required for production:** a Mux account, an API access token, and a webhook endpoint pointing at `/api/attend/webhooks/mux`. Until then the fake provider is used.
