# HYVE Attend Phase 6b: Refunds — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a buyer request a refund for one ticket, have the system build an evidence packet and recommend an outcome, and let an Attend admin/reviewer approve (issuing a real Stripe refund) or deny it.

**Architecture:** A new isolated `src/lib/attend/refunds/` module. The §31 eligibility rules are one pure, unit-tested function (`recommendRefund`). Three atomic Postgres RPCs do the multi-table money/ownership writes: `attend_request_refund` (migration 025), and `attend_process_refund` + `attend_deny_refund` (migration 026; the former replaces the migration-014 stub). The two resolution RPCs lock the request row `FOR UPDATE`, so a racing approve and deny cannot corrupt ticket state. The service layer composes the RPCs with Stripe and a synchronous evidence builder. The buyer UI is a panel on the existing wallet ticket; the admin UI is a new page under `/attend/admin/refunds`. Per spec §17 no refund is ever auto-approved — every request waits for a human; the recommendation is advisory only.

**Tech Stack:** Next.js 14 App Router, TypeScript (strict), Supabase raw-REST + plpgsql RPCs, Stripe (test mode), Vitest.

---

## Chunk 1: Refunds end to end

### Scope & isolation

Phase 6b is purely additive. Every file below is either brand-new or an Attend-owned file authored in an earlier Attend phase. No pre-existing hyve-landing file is touched. Migrations 025 and 026 are new files; 026 replaces a stub body inside an already-applied function signature (`create or replace`).

### File Structure

**New files:**

- `supabase/migrations/025_attend_request_refund.sql` — adds two columns to `attend_refund_requests`, then the `attend_request_refund` RPC.
- `supabase/migrations/026_attend_process_refund.sql` — the two refund-resolution RPCs: `attend_process_refund` (replaces the Phase 1 stub) and `attend_deny_refund` (new).
- `src/lib/attend/refunds/recommendation.ts` — the pure §17/§31 recommendation rules.
- `src/lib/attend/refunds/recommendation.test.ts` — unit tests for the rules.
- `src/lib/attend/refunds/refund-repository.ts` — raw-REST data access for the refund tables + the evidence bundle.
- `src/lib/attend/refunds/evidence-builder.ts` — assembles the §17 evidence packet (flags + JSON payload).
- `src/lib/attend/refunds/refund-service.ts` — the orchestration: `requestRefund`, `getRefundQueue`, `decideRefund`.
- `src/app/api/attend/tickets/[id]/refund/route.ts` — `POST`, the buyer opens a refund request.
- `src/app/api/attend/admin/refunds/[id]/decision/route.ts` — `POST`, the reviewer approves/denies.
- `src/app/attend/admin/refunds/page.tsx` — the admin refund queue.
- `src/app/attend/admin/refunds/refund-decision-client.tsx` — the approve/deny buttons.

**Modified files (all Attend-owned, authored in earlier phases):**

- `src/app/attend/(attendee)/wallet/wallet-ticket.tsx` — adds the "Request a refund" panel and the `REFUND_REQUESTED` notice.
- `src/app/attend/admin/layout.tsx` — adds a two-link nav (Event review / Refunds).

### Conventions confirmed from the codebase

- RPCs: `create or replace function attend_*(p_args jsonb) returns jsonb language plpgsql`. User-facing guards return structured `{ ok: false, error }` (see `attend_check_in`, `attend_claim_transfer`); hard programmer errors `raise` (see `attend_complete_checkout`).
- Migrations are applied with the Supabase MCP `apply_migration` tool — project ref `jlyqezwuyhfevrdomazd`. The `.sql` file is committed to `supabase/migrations/` as the source of record.
- Only pure logic is unit-tested in this codebase (`fee-calculator.test.ts`, `lifecycle.test.ts`, …). Repositories, services, and routes are not unit-tested — they are verified by `npx tsc --noEmit` and `npm run build`. Phase 6b's only test file is `recommendation.test.ts`.
- Error classes `ValidationError` / `NotFoundError` / `ForbiddenError` are exported from `@/lib/attend/events/service`.
- Schema facts: `attend_refund_requests` and `attend_evidence_packets` exist (migration 012). Enum `attend_refund_status` = `REQUESTED, EVIDENCE_BUILDING, AUTO_RECOMMENDED, NEEDS_HUMAN_REVIEW, APPROVED, DENIED, PROCESSED, CANCELLED`. Enum `attend_refund_recommendation` = `APPROVE, DENY, NEEDS_HUMAN`. `attend_ticket_state` includes `REFUND_REQUESTED` and `REFUNDED`. `attend_order_status` includes `PARTIALLY_REFUNDED` and `REFUNDED`. `attend_ledger_entry_type` includes `REFUND_DEBIT`. `attend_payment_kind` includes `REFUND`.

---

### Task 1: Refund recommendation rules

The spec §31 centerpiece — a pure function from evidence flags to a recommendation. Per §17 it only ever *recommends*; a human always decides.

**Files:**
- Create: `src/lib/attend/refunds/recommendation.ts`
- Test: `src/lib/attend/refunds/recommendation.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/attend/refunds/recommendation.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { recommendRefund, type RefundEvidence } from '@/lib/attend/refunds/recommendation'

// A fully-negative baseline; each test flips only the fields under test.
const base: RefundEvidence = {
  eventCancelled: false,
  artistNoShow: false,
  duplicateCharge: false,
  platformOutage: false,
  attended: false,
  eventEnded: false,
  wasTransferred: false,
}

describe('recommendRefund', () => {
  it('approves a cancelled event', () => {
    expect(recommendRefund({ ...base, eventCancelled: true })).toBe('APPROVE')
  })

  it('approves an artist no-show', () => {
    expect(recommendRefund({ ...base, artistNoShow: true, eventEnded: true })).toBe('APPROVE')
  })

  it('approves a duplicate charge', () => {
    expect(recommendRefund({ ...base, duplicateCharge: true })).toBe('APPROVE')
  })

  it('sends a platform outage to human review', () => {
    expect(recommendRefund({ ...base, platformOutage: true })).toBe('NEEDS_HUMAN')
  })

  it('sends a brief watch during an outage to review, not deny', () => {
    // §31: "entered for 30 seconds but global outage occurred" — review.
    expect(
      recommendRefund({ ...base, attended: true, platformOutage: true, eventEnded: true }),
    ).toBe('NEEDS_HUMAN')
  })

  it('denies a request from someone who attended the show', () => {
    // §31: "entered room and watched 80% of show" — deny.
    expect(recommendRefund({ ...base, attended: true, eventEnded: true })).toBe('DENY')
  })

  it('denies a no-show for an event that ran normally', () => {
    // §31: "never entered and did not cancel before cutoff" — deny.
    expect(recommendRefund({ ...base, eventEnded: true })).toBe('DENY')
  })

  it('sends an upcoming event to human review', () => {
    // Not attended, event not yet held — a reviewer applies event policy.
    expect(recommendRefund(base)).toBe('NEEDS_HUMAN')
  })

  it('lets a cancelled event override attendance', () => {
    expect(
      recommendRefund({ ...base, eventCancelled: true, attended: true, eventEnded: true }),
    ).toBe('APPROVE')
  })

  it('sends a transferred ticket to human review', () => {
    // §31: transferred-and-accepted refund rules are nuanced — a reviewer decides.
    expect(recommendRefund({ ...base, wasTransferred: true, eventEnded: true })).toBe(
      'NEEDS_HUMAN',
    )
  })

  it('still approves a cancelled event even if the ticket was transferred', () => {
    expect(recommendRefund({ ...base, wasTransferred: true, eventCancelled: true })).toBe(
      'APPROVE',
    )
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/attend/refunds/recommendation.test.ts`
Expected: FAIL — cannot resolve `@/lib/attend/refunds/recommendation`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/attend/refunds/recommendation.ts`:

```ts
// HYVE Attend refund recommendation — the spec §17 / §31 eligibility rules as
// one pure function. It only ever *recommends*: spec §17 is explicit that no
// refund is auto-approved, so a reviewer always makes the final call. The
// output is advisory, surfaced alongside the evidence packet.

export type RefundRecommendation = 'APPROVE' | 'DENY' | 'NEEDS_HUMAN'

export interface RefundEvidence {
  /** The event was cancelled before it took place. */
  eventCancelled: boolean
  /** The show is over and the stream never went live. */
  artistNoShow: boolean
  /** The buyer was charged more than once for the same seat. */
  duplicateCharge: boolean
  /** A global outage or platform-wide stream failure affected the event. */
  platformOutage: boolean
  /** The holder checked in, entered the room, or watched any of the show. */
  attended: boolean
  /** The event has already finished. */
  eventEnded: boolean
  /** The ticket has been transferred to and accepted by another account. */
  wasTransferred: boolean
}

/**
 * Recommend an outcome for a refund request from its evidence flags.
 *  - APPROVE      — the buyer clearly could not get what they paid for.
 *  - DENY         — the buyer attended, or missed a show that ran normally.
 *  - NEEDS_HUMAN  — ambiguous; a reviewer must weigh it (the default).
 */
export function recommendRefund(e: RefundEvidence): RefundRecommendation {
  // Clear platform-fault / billing-error cases: the buyer is owed a refund.
  if (e.eventCancelled || e.artistNoShow || e.duplicateCharge) return 'APPROVE'

  // An outage is never auto-decided — its scope is a human judgement (§31).
  if (e.platformOutage) return 'NEEDS_HUMAN'

  // A transferred ticket means the payer and the current holder differ; §31's
  // transfer rules are nuanced, so a reviewer always weighs these by hand.
  if (e.wasTransferred) return 'NEEDS_HUMAN'

  // The buyer received the show: attended it, or missed one that ran normally.
  if (e.attended) return 'DENY'
  if (e.eventEnded) return 'DENY'

  // Upcoming event, or anything the rules above do not settle.
  return 'NEEDS_HUMAN'
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/attend/refunds/recommendation.test.ts`
Expected: PASS — 11/11.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/attend/refunds/recommendation.ts src/lib/attend/refunds/recommendation.test.ts
git commit -m "feat(attend): add refund recommendation rules (Phase 6b task 1)"
```

---

### Task 2: Migration 025 — `attend_request_refund` RPC

The atomic write that opens a refund request. It captures the ticket's pre-request state and per-ticket price, inserts the `attend_refund_requests` row, and locks the ticket into `REFUND_REQUESTED` (which also blocks transfers and room entry, satisfying the §6 transfer lock). Returns a structured `{ ok, error? }` because every failure here is user-facing.

Two columns are added to `attend_refund_requests` first:
- `amount_cents` — the per-ticket refund amount, frozen at request time from the order line item.
- `ticket_prior_state` — the ticket state before the request, so a *denied* request can restore it.

**Files:**
- Create: `supabase/migrations/025_attend_request_refund.sql`

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/025_attend_request_refund.sql`:

```sql
-- HYVE Attend — attend_request_refund RPC + two refund-request columns.
-- A buyer opens a refund request for one ticket. Atomic: it captures the
-- ticket's pre-request state and the per-ticket price, inserts the request,
-- and locks the ticket into REFUND_REQUESTED (which also blocks transfers and
-- room entry). Returns { ok, error? } — a guard failure does not raise.

alter table attend_refund_requests
  add column if not exists amount_cents int;
alter table attend_refund_requests
  add column if not exists ticket_prior_state attend_ticket_state;

create or replace function attend_request_refund(p_args jsonb)
returns jsonb language plpgsql as $$
declare
  v_ticket_id  uuid := (p_args->>'ticket_id')::uuid;
  v_requester  uuid := (p_args->>'requester_id')::uuid;
  v_reason     text := nullif(p_args->>'reason', '');
  v_ticket     attend_tickets%rowtype;
  v_amount     int;
  v_request_id uuid;
begin
  select * into v_ticket from attend_tickets where id = v_ticket_id for update;
  if v_ticket.id is null then
    return jsonb_build_object('ok', false, 'error', 'Ticket not found.');
  end if;
  if v_ticket.owner_id is null or v_ticket.owner_id <> v_requester then
    return jsonb_build_object('ok', false, 'error', 'This is not your ticket.');
  end if;
  if v_ticket.state not in
     ('ASSIGNED_TO_BUYER','TRANSFER_ACCEPTED','CHECKED_IN','IN_ROOM','USED','NO_SHOW') then
    return jsonb_build_object('ok', false,
      'error', 'This ticket is not eligible for a refund request.');
  end if;

  -- A formal card dispute on the order routes to the dispute flow, not here (§31).
  if exists (select 1 from attend_disputes where order_id = v_ticket.order_id) then
    return jsonb_build_object('ok', false,
      'error', 'This order is under dispute. Refunds are handled through that process.');
  end if;

  -- Per-ticket refund amount: the frozen unit price paid for this tier.
  select unit_price_cents into v_amount
    from attend_order_line_items
   where order_id = v_ticket.order_id and ticket_type_id = v_ticket.ticket_type_id
   order by created_at
   limit 1;

  insert into attend_refund_requests
    (ticket_id, order_id, event_id, requester_id, reason, status,
     amount_cents, ticket_prior_state)
  values
    (v_ticket.id, v_ticket.order_id, v_ticket.event_id, v_requester, v_reason,
     'REQUESTED', coalesce(v_amount, 0), v_ticket.state)
  returning id into v_request_id;

  update attend_tickets
     set state = 'REFUND_REQUESTED', updated_at = now()
   where id = v_ticket.id;

  return jsonb_build_object('ok', true, 'refund_request_id', v_request_id);
end $$;
```

- [ ] **Step 2: Apply the migration**

Apply with the Supabase MCP `apply_migration` tool — project ref `jlyqezwuyhfevrdomazd`, name `attend_request_refund`, contents = the file above.

- [ ] **Step 3: Verify the migration applied**

Run with the Supabase MCP `execute_sql` tool:

```sql
select
  (select count(*) from information_schema.columns
     where table_name = 'attend_refund_requests'
       and column_name in ('amount_cents','ticket_prior_state')) as new_cols,
  (select count(*) from pg_proc where proname = 'attend_request_refund') as fn;
```

Expected: `new_cols = 2`, `fn = 1`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/025_attend_request_refund.sql
git commit -m "feat(attend): add attend_request_refund RPC (Phase 6b task 2)"
```

---

### Task 3: Migration 026 — refund-resolution RPCs

The two atomic writes that resolve a refund request — both lock the request row `FOR UPDATE`, so they are race-safe against each other (a concurrent approve and deny cannot corrupt the ticket state).

`attend_process_refund` (replaces the migration-014 stub) records a *completed* refund: request → `PROCESSED`, ticket → `REFUNDED`, a `REFUND` payment row, a signed `REFUND_DEBIT` ledger entry, and the order rolled to `PARTIALLY_REFUNDED` / `REFUNDED`. Idempotent on `PROCESSED`. The Stripe refund is issued by the caller *before* this RPC (deduplicated by an idempotency key — Task 6), so this finalises from any non-`PROCESSED` status; if a concurrent deny already moved the request to `DENIED`, this still wins, because the money has moved and the `PROCESSED` record must reflect reality.

`attend_deny_refund` (new) resolves a request as `DENIED` and restores the ticket to its pre-request state. Structured `{ ok, error? }` return; a request already `PROCESSED` is refused (its money has moved). Modelled on `attend_claim_transfer`'s lock-then-check pattern.

**Files:**
- Create: `supabase/migrations/026_attend_process_refund.sql`

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/026_attend_process_refund.sql`:

```sql
-- HYVE Attend — the two refund-resolution RPCs. attend_process_refund replaces
-- the migration-014 stub; attend_deny_refund is new. Both lock the request row
-- FOR UPDATE, so a concurrent approve and deny serialise cleanly.
--
-- attend_process_refund records a *completed* refund: request -> PROCESSED,
-- ticket -> REFUNDED, a REFUND payment row, a signed REFUND_DEBIT ledger entry,
-- and the order rolled to PARTIALLY_REFUNDED / REFUNDED. Idempotent on
-- PROCESSED. The Stripe refund is issued by the caller before this runs
-- (deduplicated by an idempotency key), so this finalises from any
-- non-PROCESSED status — including a request a concurrent deny just moved to
-- DENIED: the money has moved, so the PROCESSED record must win.
create or replace function attend_process_refund(p_args jsonb)
returns jsonb language plpgsql as $$
declare
  v_request_id uuid := (p_args->>'refund_request_id')::uuid;
  v_reviewer   uuid := (p_args->>'reviewer_id')::uuid;
  v_refund_id  text := nullif(p_args->>'stripe_refund_id', '');
  v_pi         text := nullif(p_args->>'stripe_payment_intent_id', '');
  v_amount     int  := (p_args->>'amount_cents')::int;
  v_request    attend_refund_requests%rowtype;
  v_order      attend_orders%rowtype;
  v_payment_id uuid;
  v_remaining  int;
begin
  select * into v_request from attend_refund_requests where id = v_request_id for update;
  if v_request.id is null then
    raise exception 'attend_process_refund: refund request % not found', v_request_id;
  end if;
  if v_request.status = 'PROCESSED' then
    return jsonb_build_object('refund_request_id', v_request_id,
      'status', 'PROCESSED', 'already_done', true);
  end if;

  select * into v_order from attend_orders where id = v_request.order_id for update;

  -- Refund payment record (kind REFUND).
  insert into attend_payments
    (kind, order_id, event_id, profile_id, amount_cents, currency, status,
     stripe_payment_intent_id, stripe_refund_id)
  values
    ('REFUND', v_request.order_id, v_request.event_id, v_request.requester_id,
     v_amount, v_order.currency, 'SUCCEEDED', v_pi, v_refund_id)
  returning id into v_payment_id;

  -- Signed ledger debit — a refund reduces the artist's pending net.
  insert into attend_ledger_entries
    (event_id, order_id, payment_id, ticket_id, type, amount_cents, currency,
     description, source, created_by)
  values
    (v_request.event_id, v_request.order_id, v_payment_id, v_request.ticket_id,
     'REFUND_DEBIT', -v_amount, v_order.currency, 'Refund to buyer', 'HUMAN',
     v_reviewer::text);

  update attend_tickets
     set state = 'REFUNDED', updated_at = now()
   where id = v_request.ticket_id;

  update attend_refund_requests
     set status = 'PROCESSED', resolved_by = v_reviewer, resolved_at = now(),
         updated_at = now()
   where id = v_request_id;

  -- Order rollup: REFUNDED once no ticket on the order is still an outstanding
  -- paid seat (CANCELLED / EXPIRED tickets are not outstanding), else
  -- PARTIALLY_REFUNDED.
  select count(*) into v_remaining
    from attend_tickets
   where order_id = v_request.order_id
     and state not in ('REFUNDED', 'CANCELLED', 'EXPIRED');
  update attend_orders
     set status = case when v_remaining = 0 then 'REFUNDED' else 'PARTIALLY_REFUNDED' end,
         updated_at = now()
   where id = v_request.order_id;

  return jsonb_build_object('refund_request_id', v_request_id, 'status', 'PROCESSED');
end $$;

-- attend_deny_refund — resolve a refund request as DENIED and return the
-- ticket to the state it held before the request (which unlocks transfers and
-- room entry). Locks the request row FOR UPDATE, so it is race-safe against a
-- concurrent approve. Structured { ok, error? } return: a PROCESSED request is
-- refused; an already-DENIED request is an idempotent no-op.
create or replace function attend_deny_refund(p_args jsonb)
returns jsonb language plpgsql as $$
declare
  v_request_id uuid := (p_args->>'refund_request_id')::uuid;
  v_reviewer   uuid := (p_args->>'reviewer_id')::uuid;
  v_request    attend_refund_requests%rowtype;
begin
  select * into v_request from attend_refund_requests where id = v_request_id for update;
  if v_request.id is null then
    return jsonb_build_object('ok', false, 'error', 'Refund request not found.');
  end if;
  if v_request.status = 'PROCESSED' then
    return jsonb_build_object('ok', false,
      'error', 'This refund has already been processed and cannot be denied.');
  end if;
  if v_request.status = 'DENIED' then
    return jsonb_build_object('ok', true, 'already_done', true);
  end if;

  if v_request.ticket_prior_state is not null then
    update attend_tickets
       set state = v_request.ticket_prior_state, updated_at = now()
     where id = v_request.ticket_id;
  end if;

  update attend_refund_requests
     set status = 'DENIED', resolved_by = v_reviewer, resolved_at = now(),
         updated_at = now()
   where id = v_request_id;

  return jsonb_build_object('ok', true);
end $$;
```

- [ ] **Step 2: Apply the migration**

Apply with the Supabase MCP `apply_migration` tool — project ref `jlyqezwuyhfevrdomazd`, name `attend_refund_resolution`, contents = the file above.

- [ ] **Step 3: Verify the migration applied**

Run with the Supabase MCP `execute_sql` tool:

```sql
select
  (select count(*) from pg_proc
     where proname = 'attend_process_refund' and prosrc like '%REFUND_DEBIT%') as process_fn,
  (select count(*) from pg_proc where proname = 'attend_deny_refund') as deny_fn;
```

Expected: one row, `process_fn = 1` (the stub body had no `REFUND_DEBIT`) and `deny_fn = 1`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/026_attend_process_refund.sql
git commit -m "feat(attend): add the refund-resolution RPCs (Phase 6b task 3)"
```

---

### Task 4: Refund repository

Raw-REST data access for the refund tables. Query-only, no business logic — modelled on `events/repository.ts` and `transfer-repository.ts`. It provides: the evidence bundle (one ticket with everything the evidence builder needs embedded), refund-request reads, the admin queue read, evidence-packet insert, and the refund-request patch.

**Files:**
- Create: `src/lib/attend/refunds/refund-repository.ts`

- [ ] **Step 1: Write the repository**

Create `src/lib/attend/refunds/refund-repository.ts`:

```ts
// Raw-REST data access for the HYVE Attend refund tables. Query-only — no
// business logic. Server-side only (service-key reads).
import { supaGet, supaPost, supaPatch } from '@/lib/supabase'

export interface RefundRequestRow {
  id: string
  ticket_id: string
  order_id: string
  event_id: string
  requester_id: string
  reason: string | null
  status: string
  recommendation: string | null
  evidence_packet_id: string | null
  amount_cents: number | null
  ticket_prior_state: string | null
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
  // The original purchase's PaymentIntent lives on the order — embedded so the
  // approve path can issue a Stripe refund without a second query.
  attend_orders: { stripe_payment_intent_id: string | null; currency: string } | null
}

// One row of the admin refund queue: the request with display context embedded.
export interface RefundQueueRow {
  id: string
  status: string
  recommendation: string | null
  reason: string | null
  amount_cents: number | null
  created_at: string
  attend_events: { title: string } | null
  attend_tickets: { state: string; attend_ticket_types: { name: string } | null } | null
}

// The evidence bundle: one ticket with everything the evidence builder needs
// embedded via PostgREST joins (event + its stream, order, attendance, transfers).
export interface TicketEvidenceBundle {
  id: string
  state: string
  checked_in_at: string | null
  attend_events: {
    id: string
    title: string
    status: string
    starts_at: string | null
    ends_at: string | null
    refund_cutoff_hours: number
    attend_streams: { status: string; started_at: string | null; ended_at: string | null }[]
  }
  attend_orders: {
    id: string
    status: string
    total_cents: number
    created_at: string
    policy_snapshot: Record<string, unknown>
    stripe_payment_intent_id: string | null
    buyer_id: string
  }
  attend_attendance_sessions: {
    joined_at: string
    left_at: string | null
    watch_seconds: number
    device: string | null
    browser: string | null
    ip_hash: string | null
  }[]
  attend_ticket_transfers: {
    method: string
    status: string
    created_at: string
    accepted_at: string | null
  }[]
}

/** One ticket with the event, stream, order, attendance and transfers embedded. */
export async function getTicketEvidenceBundle(
  ticketId: string,
): Promise<TicketEvidenceBundle | null> {
  const res = await supaGet(
    'attend_tickets',
    `id=eq.${ticketId}&select=id,state,checked_in_at,` +
      `attend_events(id,title,status,starts_at,ends_at,refund_cutoff_hours,` +
      `attend_streams(status,started_at,ended_at)),` +
      `attend_orders(id,status,total_cents,created_at,policy_snapshot,` +
      `stripe_payment_intent_id,buyer_id),` +
      `attend_attendance_sessions(joined_at,left_at,watch_seconds,device,browser,ip_hash),` +
      `attend_ticket_transfers(method,status,created_at,accepted_at)`,
  )
  if (!res.ok) throw new Error(`attend_tickets evidence query failed: ${res.status}`)
  const rows = (await res.json()) as TicketEvidenceBundle[]
  return rows[0] ?? null
}

export async function getRefundRequestById(id: string): Promise<RefundRequestRow | null> {
  const res = await supaGet(
    'attend_refund_requests',
    `id=eq.${id}&select=*,attend_orders(stripe_payment_intent_id,currency)`,
  )
  if (!res.ok) throw new Error(`attend_refund_requests query failed: ${res.status}`)
  const rows = (await res.json()) as RefundRequestRow[]
  return rows[0] ?? null
}

/** The admin queue: refund requests in an open status, oldest first (FIFO). */
export async function listRefundQueue(statuses: string[]): Promise<RefundQueueRow[]> {
  const res = await supaGet(
    'attend_refund_requests',
    `status=in.(${statuses.join(',')})&select=id,status,recommendation,reason,` +
      `amount_cents,created_at,attend_events(title),` +
      `attend_tickets(state,attend_ticket_types(name))&order=created_at.asc`,
  )
  if (!res.ok) throw new Error(`attend_refund_requests queue query failed: ${res.status}`)
  return (await res.json()) as RefundQueueRow[]
}

/** Insert the §17 evidence packet for a refund request; returns its id. */
export async function insertEvidencePacket(args: {
  refundRequestId: string
  payload: Record<string, unknown>
}): Promise<{ id: string }> {
  const res = await supaPost(
    'attend_evidence_packets',
    { subject_type: 'REFUND', refund_request_id: args.refundRequestId, payload: args.payload },
    'return=representation',
  )
  if (!res.ok) {
    throw new Error(`attend_evidence_packets insert failed: ${res.status} ${await res.text()}`)
  }
  const rows = (await res.json()) as { id: string }[]
  if (rows.length === 0) throw new Error('attend_evidence_packets insert returned no row')
  return rows[0]
}

export async function updateRefundRequest(
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const res = await supaPatch('attend_refund_requests', `id=eq.${id}`, {
    ...patch,
    updated_at: new Date().toISOString(),
  })
  if (!res.ok) {
    throw new Error(`attend_refund_requests update failed: ${res.status} ${await res.text()}`)
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/attend/refunds/refund-repository.ts
git commit -m "feat(attend): add refund repository (Phase 6b task 4)"
```

---

### Task 5: Evidence builder

Assembles the §17 evidence packet for one ticket: a rich JSON `payload` (stored on `attend_evidence_packets`) plus the `RefundEvidence` boolean flags that the §31 rules consume. The fetch (`buildRefundEvidence`) and the derivation (`deriveRefundEvidence`) are split so the derivation is a small readable pure function.

Note: `duplicateCharge` and `platformOutage` have no automated detector in the MVP — the builder sets them `false` and a reviewer flips them from the evidence. They are still wired through `RefundEvidence` so the §31 recommendation rules (Task 1) are complete and the function is fully testable.

**Files:**
- Create: `src/lib/attend/refunds/evidence-builder.ts`

- [ ] **Step 1: Write the evidence builder**

Create `src/lib/attend/refunds/evidence-builder.ts`:

```ts
// HYVE Attend refund evidence — assembles the §17 evidence packet for one
// refund request: a rich JSON payload (stored on attend_evidence_packets) plus
// the boolean flags the §31 recommendation rules consume.
import type { RefundEvidence } from '@/lib/attend/refunds/recommendation'
import {
  getTicketEvidenceBundle,
  type TicketEvidenceBundle,
} from '@/lib/attend/refunds/refund-repository'

// Event statuses that mean the show is over.
const ENDED_STATUSES = ['ENDED', 'SETTLEMENT_HOLD', 'SETTLED', 'REFUNDING', 'ARCHIVED']
// Ticket states that mean the holder reached the room.
const ATTENDED_STATES = ['CHECKED_IN', 'IN_ROOM', 'USED']

export interface RefundEvidenceResult {
  flags: RefundEvidence
  payload: Record<string, unknown>
}

/** Fetch the evidence bundle for a ticket and derive its packet + flags. */
export async function buildRefundEvidence(ticketId: string): Promise<RefundEvidenceResult> {
  const bundle = await getTicketEvidenceBundle(ticketId)
  if (!bundle) throw new Error(`refund evidence: ticket ${ticketId} not found`)
  return deriveRefundEvidence(bundle)
}

/** Pure: an evidence bundle -> the §17 payload and the §31 recommendation flags. */
export function deriveRefundEvidence(b: TicketEvidenceBundle): RefundEvidenceResult {
  const event = b.attend_events
  const stream = event.attend_streams[0] ?? null
  const sessions = b.attend_attendance_sessions ?? []
  const watchSeconds = sessions.reduce((n, s) => n + (s.watch_seconds ?? 0), 0)

  const eventEnded = ENDED_STATUSES.includes(event.status)
  const attended =
    sessions.length > 0 ||
    watchSeconds > 0 ||
    b.checked_in_at != null ||
    ATTENDED_STATES.includes(b.state)
  const wasTransferred =
    b.state === 'TRANSFER_ACCEPTED' ||
    b.attend_ticket_transfers.some((t) => t.status === 'ACCEPTED')

  const flags: RefundEvidence = {
    eventCancelled: event.status === 'CANCELLED',
    artistNoShow: eventEnded && stream != null && stream.started_at == null,
    // No automated duplicate-charge / outage detector in the MVP; a reviewer
    // sets these from the evidence. Wired so the §31 rules stay complete.
    duplicateCharge: false,
    platformOutage: false,
    attended,
    eventEnded,
    wasTransferred,
  }

  const payload: Record<string, unknown> = {
    order: {
      id: b.attend_orders.id,
      status: b.attend_orders.status,
      total_cents: b.attend_orders.total_cents,
      created_at: b.attend_orders.created_at,
      buyer_id: b.attend_orders.buyer_id,
      stripe_payment_intent_id: b.attend_orders.stripe_payment_intent_id,
    },
    ticket: { id: b.id, state: b.state, checked_in_at: b.checked_in_at },
    event: {
      id: event.id,
      title: event.title,
      status: event.status,
      starts_at: event.starts_at,
      ends_at: event.ends_at,
      refund_cutoff_hours: event.refund_cutoff_hours,
    },
    attendance: {
      session_count: sessions.length,
      total_watch_seconds: watchSeconds,
      sessions,
    },
    transfers: b.attend_ticket_transfers,
    stream,
    policy_snapshot: b.attend_orders.policy_snapshot,
    evidence_flags: flags,
    generated_at: new Date().toISOString(),
  }

  return { flags, payload }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/attend/refunds/evidence-builder.ts
git commit -m "feat(attend): add refund evidence builder (Phase 6b task 5)"
```

---

### Task 6: Refund service

The orchestration layer. `requestRefund` runs the `attend_request_refund` RPC then builds evidence and attaches the recommendation. `getRefundQueue` reads the admin queue. `decideRefund` either denies (restoring the ticket to its pre-request state) or approves (a Stripe refund keyed for idempotency, then `attend_process_refund`).

Key safety properties: (1) in `approveRefund` the Stripe call uses `idempotencyKey: attend-refund-<requestId>` and `attend_process_refund` no-ops when already `PROCESSED` — so retrying approve neither double-refunds nor double-records; (2) `denyRefund` goes through the `attend_deny_refund` RPC, which locks the request row `FOR UPDATE`, so an approve and a deny racing on the same request resolve to one consistent outcome instead of corrupting ticket state.

**Files:**
- Create: `src/lib/attend/refunds/refund-service.ts`

- [ ] **Step 1: Write the service**

Create `src/lib/attend/refunds/refund-service.ts`:

```ts
// HYVE Attend refunds — the buyer-initiated refund flow (spec §17 / §31). A
// request opens atomically (attend_request_refund); then evidence is built and
// the §31 rules attach a recommendation — but per §17 every request still
// waits for a human. Approval issues a Stripe refund and records it atomically
// (attend_process_refund); denial restores the ticket to its prior state.
import { attendStripe } from '@/lib/attend/payments/stripe'
import { recommendRefund } from '@/lib/attend/refunds/recommendation'
import { buildRefundEvidence } from '@/lib/attend/refunds/evidence-builder'
import {
  getRefundRequestById,
  listRefundQueue,
  insertEvidencePacket,
  updateRefundRequest,
  type RefundRequestRow,
  type RefundQueueRow,
} from '@/lib/attend/refunds/refund-repository'
import { ValidationError, NotFoundError } from '@/lib/attend/events/service'
import { supaPost } from '@/lib/supabase'

export type { RefundQueueRow }

// Refund-request statuses that are still open for a reviewer decision.
const OPEN_STATUSES = ['REQUESTED', 'AUTO_RECOMMENDED', 'NEEDS_HUMAN_REVIEW']

interface RpcResult {
  ok?: boolean
  error?: string
  refund_request_id?: string
}

/**
 * Open a refund request for one ticket, then build evidence and attach the
 * §31 recommendation. A failure in the (best-effort) evidence step does not
 * undo the request — a reviewer can still decide it by hand.
 */
export async function requestRefund(
  ticketId: string,
  requesterId: string,
  reason: string | null,
): Promise<void> {
  const res = await supaPost('rpc/attend_request_refund', {
    p_args: { ticket_id: ticketId, requester_id: requesterId, reason },
  })
  if (!res.ok) {
    throw new Error(`attend_request_refund RPC failed: ${res.status} ${await res.text()}`)
  }
  const result = (await res.json()) as RpcResult
  if (result.ok === false) {
    throw new ValidationError(result.error ?? 'This refund request could not be opened')
  }
  const refundRequestId = result.refund_request_id
  if (!refundRequestId) throw new Error('attend_request_refund returned no id')

  // Best-effort evidence + recommendation. A failure here must not surface to
  // the buyer — the request stands and a reviewer sees it without a hint.
  try {
    const { flags, payload } = await buildRefundEvidence(ticketId)
    const recommendation = recommendRefund(flags)
    const packet = await insertEvidencePacket({ refundRequestId, payload })
    await updateRefundRequest(refundRequestId, {
      status: recommendation === 'NEEDS_HUMAN' ? 'NEEDS_HUMAN_REVIEW' : 'AUTO_RECOMMENDED',
      recommendation,
      evidence_packet_id: packet.id,
    })
  } catch (err) {
    console.error('[attend refund] evidence build failed:', (err as Error).message)
  }
}

/** The admin queue: refund requests still awaiting a reviewer decision. */
export async function getRefundQueue(): Promise<RefundQueueRow[]> {
  return listRefundQueue(OPEN_STATUSES)
}

/**
 * A reviewer decides a refund request. Approve issues a Stripe refund (keyed
 * for idempotency) then records it via attend_process_refund; deny restores
 * the ticket to the state it held before the request.
 */
export async function decideRefund(
  refundRequestId: string,
  reviewerId: string,
  decision: 'approve' | 'deny',
): Promise<void> {
  const request = await getRefundRequestById(refundRequestId)
  if (!request) throw new NotFoundError('Refund request not found')
  if (!OPEN_STATUSES.includes(request.status)) {
    throw new ValidationError('This refund request has already been resolved')
  }

  if (decision === 'deny') {
    await denyRefund(request, reviewerId)
  } else {
    await approveRefund(request, reviewerId)
  }
}

async function denyRefund(request: RefundRequestRow, reviewerId: string): Promise<void> {
  // The RPC locks the request row, so this is race-safe against a concurrent
  // approve and restores the ticket to its pre-request state atomically.
  const res = await supaPost('rpc/attend_deny_refund', {
    p_args: { refund_request_id: request.id, reviewer_id: reviewerId },
  })
  if (!res.ok) {
    throw new Error(`attend_deny_refund RPC failed: ${res.status} ${await res.text()}`)
  }
  const result = (await res.json()) as RpcResult
  if (result.ok === false) {
    throw new ValidationError(result.error ?? 'This refund request could not be denied')
  }
}

async function approveRefund(request: RefundRequestRow, reviewerId: string): Promise<void> {
  const paymentIntentId = request.attend_orders?.stripe_payment_intent_id
  const amountCents = request.amount_cents ?? 0
  if (!paymentIntentId) {
    throw new ValidationError('The original payment for this order could not be found')
  }
  if (amountCents <= 0) {
    throw new ValidationError('This refund has no amount to return')
  }

  // Stripe refund — keyed on the request id so a retry never double-refunds.
  const refund = await attendStripe().refunds.create(
    { payment_intent: paymentIntentId, amount: amountCents },
    { idempotencyKey: `attend-refund-${request.id}` },
  )

  // Atomic record: request -> PROCESSED, ticket -> REFUNDED, ledger + order.
  const res = await supaPost('rpc/attend_process_refund', {
    p_args: {
      refund_request_id: request.id,
      reviewer_id: reviewerId,
      stripe_refund_id: refund.id,
      stripe_payment_intent_id: paymentIntentId,
      amount_cents: amountCents,
    },
  })
  if (!res.ok) {
    throw new Error(`attend_process_refund RPC failed: ${res.status} ${await res.text()}`)
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/attend/refunds/refund-service.ts
git commit -m "feat(attend): add refund service (Phase 6b task 6)"
```

---

### Task 7: Buyer refund-request route

`POST /api/attend/tickets/[id]/refund` — the signed-in buyer opens a refund request. Body `{ reason?: string }`; reason is optional. Modelled on `tickets/[id]/transfer/route.ts`.

**Files:**
- Create: `src/app/api/attend/tickets/[id]/refund/route.ts`

- [ ] **Step 1: Write the route**

Create `src/app/api/attend/tickets/[id]/refund/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { requireAttendUser } from '@/lib/attend/identity/roles'
import { requestRefund } from '@/lib/attend/refunds/refund-service'
import { ValidationError } from '@/lib/attend/events/service'

export const runtime = 'nodejs'

// POST /api/attend/tickets/[id]/refund — the buyer opens a refund request.
// Body: { reason?: string }.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAttendUser()
  if (!user) return NextResponse.json({ error: 'Please sign in' }, { status: 401 })

  let body: { reason?: unknown } = {}
  try {
    body = (await req.json()) as { reason?: unknown }
  } catch {
    // An empty body is fine — reason is optional.
  }
  const reason = typeof body.reason === 'string' ? body.reason.trim() || null : null

  try {
    await requestRefund(params.id, user.id, reason)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[attend refund request]:', (err as Error).message)
    return NextResponse.json(
      { error: 'Refund request could not be opened' },
      { status: 500 },
    )
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/attend/tickets/[id]/refund/route.ts"
git commit -m "feat(attend): add buyer refund-request route (Phase 6b task 7)"
```

---

### Task 8: Buyer refund UI on the wallet ticket

Add a "Request a refund" panel to `wallet-ticket.tsx`: a ghost button (for refundable states) that expands to an optional-reason textarea, a calm §32-toned disclaimer, and a submit that posts to the Task 7 route. When the ticket is `REFUND_REQUESTED`, show the §17 "review in progress" notice instead. The transfer UI is unchanged; the refund and transfer buttons sit side by side for an idle ticket.

This is a full rewrite of the file (several insertion points) — replace its entire contents.

**Files:**
- Modify: `src/app/attend/(attendee)/wallet/wallet-ticket.tsx` (full rewrite)

- [ ] **Step 1: Rewrite the component**

Replace the entire contents of `src/app/attend/(attendee)/wallet/wallet-ticket.tsx` with:

```tsx
'use client'

import { useState } from 'react'
import type { OwnedTicket } from '@/lib/attend/ticketing/ticket-repository'

const IDLE_STATES = ['ASSIGNED_TO_BUYER', 'TRANSFER_ACCEPTED']
const PENDING_STATES = ['TRANSFER_PENDING_EMAIL', 'TRANSFER_PENDING_FRIEND_CODE']
const REFUNDABLE_STATES = [
  'ASSIGNED_TO_BUYER', 'TRANSFER_ACCEPTED', 'CHECKED_IN', 'IN_ROOM', 'USED', 'NO_SHOW',
]

const humanize = (s: string) =>
  s.charAt(0).toUpperCase() + s.slice(1).toLowerCase().replace(/_/g, ' ')
const stateLabel = (s: string) => (s === 'ASSIGNED_TO_BUYER' ? 'Confirmed' : humanize(s))

const inputClass =
  'rounded border border-[#2a2135] bg-[#08070a] px-3 py-2 text-sm text-[#ede8d8] outline-none focus:border-[#E8C456]'
const actionBtn =
  'rounded bg-[#E8C456] px-3 py-1.5 text-xs font-bold text-black transition hover:brightness-110 disabled:opacity-50'
const ghostBtn =
  'rounded border border-[#2a2135] px-3 py-1.5 text-xs font-bold text-[#9e8a55] transition hover:text-[#E8C456] disabled:opacity-50'

export default function WalletTicket({ ticket }: { ticket: OwnedTicket }) {
  const [open, setOpen] = useState(false)
  const [method, setMethod] = useState<'EMAIL' | 'FRIEND_CODE'>('EMAIL')
  const [email, setEmail] = useState('')
  const [refundOpen, setRefundOpen] = useState(false)
  const [refundReason, setRefundReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const idle = IDLE_STATES.includes(ticket.state)
  const pending = PENDING_STATES.includes(ticket.state)
  const refundable = REFUNDABLE_STATES.includes(ticket.state)
  const refundRequested = ticket.state === 'REFUND_REQUESTED'
  const pendingTransfer = ticket.attend_ticket_transfers.find((t) => t.status === 'PENDING')

  const showTransferBtn = idle && !open
  const showRefundBtn = refundable && !refundOpen

  async function startTransfer() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/attend/tickets/${ticket.id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, toEmail: method === 'EMAIL' ? email : undefined }),
      })
      if (res.ok) {
        // The reloaded wallet shows the pending state (and the friend code).
        window.location.reload()
        return
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      setError(data.error ?? 'Transfer could not be started')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function revoke() {
    if (!pendingTransfer) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/attend/transfers/${pendingTransfer.id}/revoke`, {
        method: 'POST',
      })
      if (res.ok) {
        window.location.reload()
        return
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      setError(data.error ?? 'Revoke failed')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function requestRefund() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/attend/tickets/${ticket.id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: refundReason }),
      })
      if (res.ok) {
        // The reloaded wallet shows the "review in progress" notice.
        window.location.reload()
        return
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      setError(data.error ?? 'Refund request could not be opened')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="rounded border border-[#2a2135] px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-bold">{ticket.attend_ticket_types.name}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#E8C456]">
          {stateLabel(ticket.state)}
        </span>
      </div>

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      {refundRequested && (
        <p className="mt-2 text-xs text-[#9e8a55]">
          Refund requested — review in progress. HYVE is checking attendance,
          ticket, event, and stream records. Review may take up to 30 days.
        </p>
      )}

      {(showTransferBtn || showRefundBtn) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {showTransferBtn && (
            <button onClick={() => setOpen(true)} className={ghostBtn}>
              Transfer ticket
            </button>
          )}
          {showRefundBtn && (
            <button onClick={() => setRefundOpen(true)} className={ghostBtn}>
              Request a refund
            </button>
          )}
        </div>
      )}

      {idle && open && (
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              onClick={() => setMethod('EMAIL')}
              className={method === 'EMAIL' ? actionBtn : ghostBtn}
            >
              By email
            </button>
            <button
              onClick={() => setMethod('FRIEND_CODE')}
              className={method === 'FRIEND_CODE' ? actionBtn : ghostBtn}
            >
              By friend code
            </button>
          </div>
          {method === 'EMAIL' && (
            <input
              type="email"
              placeholder="recipient@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={startTransfer}
              disabled={busy || (method === 'EMAIL' && email.trim().length === 0)}
              className={actionBtn}
            >
              {busy ? 'Working…' : 'Send transfer'}
            </button>
            <button onClick={() => setOpen(false)} disabled={busy} className={ghostBtn}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {refundable && refundOpen && (
        <div className="mt-2 flex flex-col gap-2">
          <textarea
            placeholder="Tell us why you're requesting a refund (optional)"
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
            rows={3}
            className={inputClass}
          />
          <p className="text-[11px] text-[#9e8a55]">
            Submitting a request does not guarantee a refund. HYVE reviews each
            request against attendance and event records.
          </p>
          <div className="flex gap-2">
            <button onClick={requestRefund} disabled={busy} className={actionBtn}>
              {busy ? 'Working…' : 'Submit request'}
            </button>
            <button onClick={() => setRefundOpen(false)} disabled={busy} className={ghostBtn}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {pending && pendingTransfer && (
        <div className="mt-2 flex flex-col gap-2">
          <p className="text-xs text-[#9e8a55]">
            {pendingTransfer.method === 'FRIEND_CODE'
              ? 'Waiting to be claimed with a friend code.'
              : `Waiting for ${pendingTransfer.to_email ?? 'the recipient'} to claim.`}
          </p>
          {pendingTransfer.method === 'FRIEND_CODE' && pendingTransfer.friend_code && (
            <p className="font-mono text-sm font-black text-[#E8C456]">
              {pendingTransfer.friend_code}
            </p>
          )}
          <button onClick={revoke} disabled={busy} className={ghostBtn}>
            {busy ? 'Working…' : 'Revoke transfer'}
          </button>
        </div>
      )}
    </li>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/attend/(attendee)/wallet/wallet-ticket.tsx"
git commit -m "feat(attend): add refund request to the wallet ticket (Phase 6b task 8)"
```

---

### Task 9: Admin refund-decision route

`POST /api/attend/admin/refunds/[id]/decision` — an ADMIN/REVIEWER approves or denies a refund request. Body `{ decision: 'approve' | 'deny' }`. Modelled on `admin/events/[id]/review/route.ts`, including the `writeAuditLog` call (refund decisions are §10 sensitive actions).

**Files:**
- Create: `src/app/api/attend/admin/refunds/[id]/decision/route.ts`

- [ ] **Step 1: Write the route**

Create `src/app/api/attend/admin/refunds/[id]/decision/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { requireReviewer } from '@/lib/attend/identity/roles'
import { decideRefund } from '@/lib/attend/refunds/refund-service'
import { NotFoundError, ValidationError } from '@/lib/attend/events/service'
import { writeAuditLog } from '@/lib/attend/audit/audit-log'

export const runtime = 'nodejs'

// POST /api/attend/admin/refunds/[id]/decision — approve or deny a refund
// request. Body: { decision: 'approve' | 'deny' }. ADMIN/REVIEWER only.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const reviewer = await requireReviewer()
  if (!reviewer) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  let body: { decision?: unknown }
  try {
    body = (await req.json()) as { decision?: unknown }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (body.decision !== 'approve' && body.decision !== 'deny') {
    return NextResponse.json({ error: 'decision must be approve or deny' }, { status: 400 })
  }

  try {
    await decideRefund(params.id, reviewer.id, body.decision)
    await writeAuditLog({
      actorId: reviewer.id,
      action: `refund.${body.decision}`,
      entityType: 'REFUND_REQUEST',
      entityId: params.id,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 })
    }
    console.error('[attend refund decision]:', (err as Error).message)
    return NextResponse.json(
      { error: 'That decision could not be recorded' },
      { status: 500 },
    )
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/attend/admin/refunds/[id]/decision/route.ts"
git commit -m "feat(attend): add admin refund-decision route (Phase 6b task 9)"
```

---

### Task 10: Admin refund queue page + nav

A new page at `/attend/admin/refunds` listing open refund requests with the system recommendation as a colour-coded hint, each with approve/deny buttons. A two-link nav is added to the Attend admin layout so reviewers can move between the event-review queue and the refund queue.

**Files:**
- Create: `src/app/attend/admin/refunds/page.tsx`
- Create: `src/app/attend/admin/refunds/refund-decision-client.tsx`
- Modify: `src/app/attend/admin/layout.tsx` (add the nav)

- [ ] **Step 1: Write the decision client**

Create `src/app/attend/admin/refunds/refund-decision-client.tsx` (modelled on `admin/review-client.tsx`):

```tsx
'use client'

import { useState } from 'react'

const btn = 'rounded px-3 py-1.5 text-xs font-bold transition disabled:opacity-50'

export default function RefundDecisionClient({ refundRequestId }: { refundRequestId: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function decide(decision: 'approve' | 'deny') {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/attend/admin/refunds/${refundRequestId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      })
      if (res.ok) {
        window.location.reload()
        return
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      setError(data.error ?? 'That decision could not be recorded')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          onClick={() => decide('approve')}
          disabled={busy}
          className={`${btn} bg-[#E8C456] text-black hover:brightness-110`}
        >
          Approve
        </button>
        <button
          onClick={() => decide('deny')}
          disabled={busy}
          className={`${btn} border border-[#2a2135] text-[#9e8a55] hover:text-red-400`}
        >
          Deny
        </button>
      </div>
      {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Write the queue page**

Create `src/app/attend/admin/refunds/page.tsx` (modelled on `admin/page.tsx`):

```tsx
import { getRefundQueue } from '@/lib/attend/refunds/refund-service'
import RefundDecisionClient from './refund-decision-client'

export const metadata = { title: 'Refund queue — Attend admin' }
export const dynamic = 'force-dynamic'

const usd = (c: number | null) => (c == null ? '—' : `$${(c / 100).toFixed(2)}`)
const recColor: Record<string, string> = {
  APPROVE: 'text-green-400',
  DENY: 'text-red-400',
  NEEDS_HUMAN: 'text-[#E8C456]',
}

export default async function RefundQueuePage() {
  const queue = await getRefundQueue()

  return (
    <div>
      <h2 className="text-xs font-black tracking-[0.2em] text-[#9e8a55]">
        REFUND REQUESTS AWAITING A DECISION
      </h2>
      {queue.length === 0 ? (
        <p className="mt-3 text-sm text-[#9e8a55]">No refund requests to review.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {queue.map((r) => (
            <li
              key={r.id}
              className="flex items-start justify-between gap-3 rounded border border-[#2a2135] bg-[#111111] px-4 py-3"
            >
              <div>
                <span className="text-sm font-bold">
                  {r.attend_events?.title ?? 'Event'}
                </span>
                <p className="text-xs text-[#9e8a55]">
                  {r.attend_tickets?.attend_ticket_types?.name ?? 'Ticket'} ·{' '}
                  {usd(r.amount_cents)}
                </p>
                {r.reason && <p className="mt-1 text-xs text-[#ede8d8]">“{r.reason}”</p>}
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#9e8a55]">
                  System recommendation:{' '}
                  <span className={recColor[r.recommendation ?? ''] ?? 'text-[#9e8a55]'}>
                    {r.recommendation ?? 'PENDING'}
                  </span>
                </p>
              </div>
              <RefundDecisionClient refundRequestId={r.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Add the nav to the admin layout**

In `src/app/attend/admin/layout.tsx`, add `import Link from 'next/link'` at the top, and insert a nav between the header `div` and the `<div className="mt-6">{children}</div>`. The result:

```tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireReviewer } from '@/lib/attend/identity/roles'

export const dynamic = 'force-dynamic'

const navLink = 'text-[#9e8a55] transition hover:text-[#E8C456]'

// Server-side gate for the Attend back office — ADMIN/REVIEWER only,
// independent of the umbrella /admin. A non-reviewer is bounced silently.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const reviewer = await requireReviewer()
  if (!reviewer) redirect('/attend')

  return (
    <div className="py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Attend admin</h1>
        <span className="font-mono text-[10px] tracking-widest text-[#E8C456]">
          {reviewer.role}
        </span>
      </div>
      <nav className="mt-4 flex gap-4 border-b border-[#2a2135] pb-2 text-xs font-bold">
        <Link href="/attend/admin" className={navLink}>
          Event review
        </Link>
        <Link href="/attend/admin/refunds" className={navLink}>
          Refunds
        </Link>
      </nav>
      <div className="mt-6">{children}</div>
    </div>
  )
}
```

- [ ] **Step 4: Typecheck and build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds; the route list includes `/attend/admin/refunds` and the two new API routes.

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass, including the new `recommendation.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add "src/app/attend/admin/refunds/page.tsx" "src/app/attend/admin/refunds/refund-decision-client.tsx" "src/app/attend/admin/layout.tsx"
git commit -m "feat(attend): add admin refund queue + nav (Phase 6b task 10)"
```

---

## Verification & acceptance

After all tasks, confirm:

- `npx tsc --noEmit`, `npx vitest run`, and `npm run build` all pass.
- Migrations 025 and 026 are applied (the Task 2 / Task 3 probe queries).
- The §27 acceptance criteria touched by this phase (spec §27 line ~1080): "User can request refund", "Refund request auto-builds evidence summary", "Admin can approve/deny refund" — all reachable: wallet → request → evidence packet + recommendation → admin queue → approve (Stripe refund + ledger) / deny (ticket restored).
- Isolation holds: `git diff main --stat` shows only new files plus the two Attend-owned files (`wallet-ticket.tsx`, `admin/layout.tsx`); no pre-existing hyve-landing file is modified.

**Deferred to later phases (out of scope for 6b):**
- `attend_cancel_event_refunds` (bulk refund on event cancellation) and `attend_release_payout` — Phase 6c.
- Disputes / chargebacks (§18), the `attend_disputes` write path — Phase 6c. (6b only *reads* `attend_disputes` to block a refund request on a disputed order.)
- Automated duplicate-charge and platform-outage detection — the `recommendRefund` rules are complete and tested; only their evidence *producers* are stubbed `false`.
- The §17 30-day review SLA timer and buyer email notifications on a decision.
- §17 evidence sources not yet wired in: moderator actions and support-message history. The packet covers order / ticket / event / attendance / transfer / stream / IP-hash records — sufficient for the MVP.

