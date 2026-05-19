# HYVE Attend Phase 7: Hardening — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the two remaining §25 background-job gaps so a ticket's lifecycle resolves cleanly after an event — attendance finalization (tickets that attended become `USED`, those that did not become `NO_SHOW`) and stale-transfer expiry (an unclaimed transfer past its window releases the ticket back to its owner).

**Architecture:** Two new plpgsql RPCs (migration 033). `attend_finalize_attendance` is driven off the event-end path — the Mux `idle` webhook already ends the event, so the streaming service finalizes attendance in the same step. `attend_expire_stale_transfers` is a bulk sweep run by a new cron-gated job, modelled on the existing cart-expiry job. No pure TypeScript logic is added, so there is no new unit-test file; the RPCs are verified by probe queries and the build.

**Tech Stack:** Next.js 14 App Router, TypeScript (strict), Supabase raw-REST + plpgsql RPCs.

---

## Chunk 1: Lifecycle hardening

### Scope & isolation

Phase 7 is purely additive. New files plus one Attend-owned file modified: `src/lib/attend/streaming/streaming-service.ts` (a finalization call on the event-end path). Migration 033 is a new file.

**Scope boundary:** Phase 7 finalizes the post-event ticket lifecycle and expires stale transfers. The remaining §25 jobs — event-start countdown notifications, stream-health polling, replay processing — are post-MVP features (each needs a delivery channel, provider polling, or Mux asset handling and its own UI); they are not §27 acceptance criteria and are out of scope here.

### File Structure

**New files:**

- `supabase/migrations/033_attend_lifecycle_jobs.sql` — the `attend_finalize_attendance` and `attend_expire_stale_transfers` RPCs.
- `src/lib/attend/transfers/transfer-expiry-service.ts` — runs the transfer-expiry sweep.
- `src/app/api/attend/jobs/transfer-expiry/route.ts` — the cron-gated transfer-expiry job.

**Modified file (Attend-owned):**

- `src/lib/attend/streaming/streaming-service.ts` — finalizes attendance when the Mux `idle` webhook ends the event.

### Conventions confirmed from the codebase

- RPCs: `create or replace function attend_*(p_args jsonb) returns jsonb language plpgsql`; `raise` on a hard programmer error, return a jsonb summary otherwise. Applied via the Supabase MCP `apply_migration` tool — project ref `jlyqezwuyhfevrdomazd`.
- Background jobs: a `GET` route under `src/app/api/attend/jobs/`, gated by a constant-time bearer check of `ATTEND_CRON_SECRET`, returning `{ ok, ...summary }` (the `cart-expiry` pattern in `src/app/api/attend/jobs/cart-expiry/route.ts` + `src/lib/attend/payments/cart-expiry-service.ts`).
- `applyMuxStreamEvent` in `streaming-service.ts` handles the Mux webhook; its `video.live_stream.idle` branch already calls `markEventEnded`. `streaming-service.ts` does not yet import `supaPost`.
- Schema facts: `attend_event_status` includes `ENDED, SETTLEMENT_HOLD, SETTLED`. `attend_ticket_state` includes `ASSIGNED_TO_BUYER, TRANSFER_ACCEPTED, CHECKED_IN, IN_ROOM, USED, NO_SHOW, TRANSFER_PENDING_EMAIL, TRANSFER_PENDING_FRIEND_CODE, EXPIRED`. `attend_transfer_status` includes `PENDING, EXPIRED`. `attend_attendance_sessions` — `event_id, ticket_id, joined_at, left_at, watch_seconds`. `attend_ticket_transfers` — `ticket_id, status, expires_at`.

---

### Task 1: Migration 033 — the lifecycle RPCs

`attend_finalize_attendance` resolves an ended event's ticket lifecycle: it closes any attendance session left open, marks every ticket that reached the room `USED`, and marks every sold ticket that never entered `NO_SHOW`. `attend_expire_stale_transfers` is a bulk sweep: a `PENDING` transfer past its `expires_at` becomes `EXPIRED` and its ticket returns to `ASSIGNED_TO_BUYER`. Both are idempotent.

**Files:**
- Create: `supabase/migrations/033_attend_lifecycle_jobs.sql`

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/033_attend_lifecycle_jobs.sql`:

```sql
-- HYVE Attend — the two remaining §25 lifecycle jobs.
--
-- attend_finalize_attendance resolves an ended event's ticket lifecycle:
-- close any attendance session left open, mark tickets that reached the room
-- USED, and mark sold tickets that never entered NO_SHOW. Tickets in a
-- refund / dispute / transfer-pending state are left untouched. Idempotent —
-- a re-run finds no tickets in the pre-final states.
create or replace function attend_finalize_attendance(p_args jsonb)
returns jsonb language plpgsql as $$
declare
  v_event_id uuid := (p_args->>'event_id')::uuid;
  v_status   attend_event_status;
  v_used     int;
  v_no_show  int;
begin
  select status into v_status from attend_events where id = v_event_id;
  if v_status is null then
    raise exception 'attend_finalize_attendance: event % not found', v_event_id;
  end if;
  -- Only an event that has actually ended is finalized.
  if v_status not in ('ENDED', 'SETTLEMENT_HOLD', 'SETTLED') then
    return jsonb_build_object('event_id', v_event_id, 'finalized', false,
      'reason', 'event has not ended');
  end if;

  -- Close any attendance session left open when the stream ended.
  update attend_attendance_sessions
     set left_at = now(),
         watch_seconds = greatest(watch_seconds,
           extract(epoch from now() - joined_at)::int)
   where event_id = v_event_id and left_at is null;

  -- A ticket that reached the room is USED; a sold ticket that never entered
  -- is a NO_SHOW. (The check-in flow moves an attended ticket to IN_ROOM, so
  -- an attended ticket is never left in ASSIGNED_TO_BUYER.)
  update attend_tickets set state = 'USED', updated_at = now()
   where event_id = v_event_id and state in ('CHECKED_IN', 'IN_ROOM');
  get diagnostics v_used = row_count;

  update attend_tickets set state = 'NO_SHOW', updated_at = now()
   where event_id = v_event_id and state in ('ASSIGNED_TO_BUYER', 'TRANSFER_ACCEPTED');
  get diagnostics v_no_show = row_count;

  return jsonb_build_object('event_id', v_event_id, 'finalized', true,
    'used', v_used, 'no_show', v_no_show);
end $$;

-- attend_expire_stale_transfers sweeps PENDING ticket transfers past their
-- expiry window: the ticket returns to its owner (ASSIGNED_TO_BUYER) and the
-- transfer is marked EXPIRED. The ticket restore runs first, so its subquery
-- still sees the transfers as PENDING. Idempotent — a re-run finds none.
create or replace function attend_expire_stale_transfers(p_args jsonb)
returns jsonb language plpgsql as $$
declare
  v_expired int;
begin
  update attend_tickets set state = 'ASSIGNED_TO_BUYER', updated_at = now()
   where state in ('TRANSFER_PENDING_EMAIL', 'TRANSFER_PENDING_FRIEND_CODE')
     and id in (
       select ticket_id from attend_ticket_transfers
        where status = 'PENDING' and expires_at < now()
     );

  update attend_ticket_transfers set status = 'EXPIRED'
   where status = 'PENDING' and expires_at < now();
  get diagnostics v_expired = row_count;

  return jsonb_build_object('expired', v_expired);
end $$;
```

- [ ] **Step 2: Apply the migration**

Apply with the Supabase MCP `apply_migration` tool — project ref `jlyqezwuyhfevrdomazd`, name `attend_lifecycle_jobs`, contents = the file above.

- [ ] **Step 3: Verify the migration applied**

Run with the Supabase MCP `execute_sql` tool:

```sql
select count(*) as fns from pg_proc
 where proname in ('attend_finalize_attendance', 'attend_expire_stale_transfers');
```

Expected: one row, `fns = 2`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/033_attend_lifecycle_jobs.sql
git commit -m "feat(attend): add the lifecycle-job RPCs (Phase 7 task 1)"
```

---

### Task 2: Finalize attendance on event end

When the Mux `idle` webhook ends an event, the streaming service finalizes its attendance in the same step.

**Files:**
- Modify: `src/lib/attend/streaming/streaming-service.ts`

- [ ] **Step 1: Add the `supaPost` import**

In `src/lib/attend/streaming/streaming-service.ts`, add to the imports (after the `events/service` import block):

```ts
import { supaPost } from '@/lib/supabase'
```

- [ ] **Step 2: Add the finalization helper**

Add this function to `streaming-service.ts` (after `applyMuxStreamEvent`):

```ts
/**
 * Finalize an ended event's attendance — close open sessions, mark tickets
 * USED / NO_SHOW. Best-effort: a failure is logged, not thrown, so it never
 * fails the webhook (the event has already been ended).
 */
export async function finalizeEventAttendance(eventId: string): Promise<void> {
  try {
    const res = await supaPost('rpc/attend_finalize_attendance', {
      p_args: { event_id: eventId },
    })
    if (!res.ok) {
      console.error(
        `[attend streaming] attend_finalize_attendance failed for ${eventId}: ` +
          `${res.status} ${await res.text()}`,
      )
    }
  } catch (err) {
    console.error(
      `[attend streaming] finalize attendance error for ${eventId}:`,
      (err as Error).message,
    )
  }
}
```

- [ ] **Step 3: Call it from the `idle` branch**

In `applyMuxStreamEvent`, replace the `idle` branch of the lifecycle block:

```ts
  } else if (eventType === 'video.live_stream.idle') {
    await markEventEnded(stream.event_id)
  }
```

with:

```ts
  } else if (eventType === 'video.live_stream.idle') {
    await markEventEnded(stream.event_id)
    await finalizeEventAttendance(stream.event_id)
  }
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/attend/streaming/streaming-service.ts
git commit -m "feat(attend): finalize attendance on event end (Phase 7 task 2)"
```

---

### Task 3: Transfer-expiry job

A cron-gated job that sweeps stale ticket transfers, modelled on the cart-expiry job.

**Files:**
- Create: `src/lib/attend/transfers/transfer-expiry-service.ts`
- Create: `src/app/api/attend/jobs/transfer-expiry/route.ts`

- [ ] **Step 1: Write the service**

Create `src/lib/attend/transfers/transfer-expiry-service.ts`:

```ts
// HYVE Attend transfer expiry — sweeps PENDING ticket transfers past their
// expiry window via the atomic attend_expire_stale_transfers RPC, returning
// each lapsed ticket to its owner. Run on a schedule; idempotent.
import { supaPost } from '@/lib/supabase'

export async function expireStaleTransfers(): Promise<{ expired: number }> {
  const res = await supaPost('rpc/attend_expire_stale_transfers', { p_args: {} })
  if (!res.ok) {
    throw new Error(
      `attend_expire_stale_transfers RPC failed: ${res.status} ${await res.text()}`,
    )
  }
  return (await res.json()) as { expired: number }
}
```

- [ ] **Step 2: Write the job route**

Create `src/app/api/attend/jobs/transfer-expiry/route.ts`:

```ts
import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { expireStaleTransfers } from '@/lib/attend/transfers/transfer-expiry-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CRON_SECRET = process.env.ATTEND_CRON_SECRET

// Constant-time bearer check — avoids leaking the secret via response timing.
function authorized(header: string | null, secret: string): boolean {
  const expected = `Bearer ${secret}`
  const provided = header ?? ''
  return (
    provided.length === expected.length &&
    timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  )
}

// GET /api/attend/jobs/transfer-expiry — invoked on a schedule. Expires stale
// PENDING ticket transfers. Bearer-secret gated; the RPC is idempotent.
export async function GET(req: NextRequest) {
  if (!CRON_SECRET) {
    console.error('[transfer-expiry] ATTEND_CRON_SECRET not set')
    return NextResponse.json({ error: 'Cron not configured' }, { status: 500 })
  }
  if (!authorized(req.headers.get('authorization'), CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const summary = await expireStaleTransfers()
    return NextResponse.json({ ok: true, ...summary })
  } catch (err) {
    console.error('[transfer-expiry] run failed:', (err as Error).message)
    return NextResponse.json({ error: 'Transfer expiry failed' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Typecheck, build, and run the test suite**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds; the route list includes `/api/attend/jobs/transfer-expiry`.

Run: `npx vitest run`
Expected: all 93 existing tests still pass (Phase 7 adds no test file).

- [ ] **Step 4: Commit**

```bash
git add src/lib/attend/transfers/transfer-expiry-service.ts "src/app/api/attend/jobs/transfer-expiry/route.ts"
git commit -m "feat(attend): add the transfer-expiry job (Phase 7 task 3)"
```

---

## Verification & acceptance

After all tasks, confirm:

- `npx tsc --noEmit`, `npx vitest run`, and `npm run build` all pass.
- Migration 033 is applied (the Task 1 probe).
- The lifecycle resolves: an event ending via the Mux `idle` webhook finalizes its attendance (tickets → `USED` / `NO_SHOW`, open sessions closed); a stale transfer is swept to `EXPIRED` with its ticket released.
- Isolation holds: `git diff main --stat` shows only new files plus the Attend-owned `streaming-service.ts`.

**Notes / deferred:**
- A lapsed *outbound* transfer of a previously-received ticket restores it to `ASSIGNED_TO_BUYER` (the generic owned-and-active state) rather than `TRANSFER_ACCEPTED`. This is intentional — the `attend_ticket_transfers` rows retain the full provenance.

**Deferred (post-MVP — not §27 acceptance criteria):**
- Event-start countdown notifications — needs a delivery channel (email/push) and a notifications surface.
- Stream-health polling and replay processing — need provider polling and Mux asset handling plus a replay view.
- AI scheduled performances (bible Phase 7) and the VR add-on (bible Phase 8) — separate product surfaces; the build bible §29 explicitly sequences them last.
