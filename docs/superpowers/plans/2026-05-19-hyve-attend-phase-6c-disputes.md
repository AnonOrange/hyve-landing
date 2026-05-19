# HYVE Attend Phase 6c: Disputes & Chargebacks — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ingest Stripe card disputes via webhook, freeze the disputed order, auto-build a §18 evidence packet with a contest/accept recommendation, and give an Attend admin a dispute queue to submit evidence to Stripe or concede.

**Architecture:** A new isolated `src/lib/attend/disputes/` module — the structural twin of Phase 6b's refunds module, but webhook-driven instead of buyer-driven. Two atomic Postgres RPCs do the multi-table money writes: `attend_open_dispute` and `attend_close_dispute` (migration 028). The §18 contest/accept rules are one pure, unit-tested function. The Attend Stripe webhook gains `charge.dispute.created` / `charge.dispute.closed` branches. The admin UI is a new `/attend/admin/disputes` queue. The ledger treats a dispute as a temporary hold released on close.

**Tech Stack:** Next.js 14 App Router, TypeScript (strict), Supabase raw-REST + plpgsql RPCs, Stripe (test mode), Vitest.

---

## Chunk 1: Disputes end to end

### Scope & isolation

Phase 6c is purely additive. Every file below is new except two Attend-owned files authored in earlier Attend phases: `src/app/api/attend/webhooks/stripe/route.ts` (dispute branches added) and `src/app/attend/admin/layout.tsx` (a nav link added). No pre-existing non-Attend file is touched. Migration 028 is a new file.

**Scope boundary:** 6c handles dispute *ingestion, evidence, and resolution*. It does NOT build payouts/settlement (Phase 6d) or risk-rule tuning (Phase 6e). "Freeze the related payout amount" (§18) is satisfied at the ledger level (a `DISPUTE_HOLD` entry) — there is no payout to freeze until 6d, and 6d's payout logic will check for open disputes.

### File Structure

**New files:**

- `supabase/migrations/028_attend_disputes.sql` — the `attend_open_dispute` and `attend_close_dispute` RPCs.
- `src/lib/attend/disputes/dispute-recommendation.ts` + `.test.ts` — pure §18 contest/accept rules + a due-soon check.
- `src/lib/attend/disputes/dispute-repository.ts` — raw-REST data access for `attend_disputes` + the order evidence bundle.
- `src/lib/attend/disputes/dispute-evidence-builder.ts` — assembles the §18 evidence packet (order-scoped).
- `src/lib/attend/disputes/dispute-service.ts` — orchestration: ingest created/closed, queue, submit-evidence, accept.
- `src/app/api/attend/admin/disputes/[id]/route.ts` — `POST`, the reviewer submits evidence or concedes.
- `src/app/attend/admin/disputes/page.tsx` + `dispute-action-client.tsx` — the admin dispute queue.

**Modified files (both Attend-owned, authored in earlier phases):**

- `src/app/api/attend/webhooks/stripe/route.ts` — adds the two `charge.dispute.*` branches.
- `src/app/attend/admin/layout.tsx` — adds a "Disputes" nav link.

### Conventions confirmed from the codebase

- RPCs: `create or replace function attend_*(p_args jsonb) returns jsonb language plpgsql`. Webhook-driven RPCs `raise` on a hard error and return a jsonb object with `already_done: true` on an idempotent replay (the `attend_complete_checkout` pattern). Migrations are applied via the Supabase MCP `apply_migration` tool — project ref `jlyqezwuyhfevrdomazd`.
- The Attend Stripe webhook (`webhooks/stripe/route.ts`) already has exactly-once delivery via `claimWebhookEvent` and a retry-on-failure model. Handlers must be idempotent. New event types are added as `else if` branches in its `try` block.
- Only pure logic is unit-tested. Phase 6c's only test file is `dispute-recommendation.test.ts`. Repositories/services/routes are verified by `npx tsc --noEmit` and `npm run build`.
- Error classes `ValidationError` / `NotFoundError` are exported from `@/lib/attend/events/service`. `attendStripe()` is from `@/lib/attend/payments/stripe`. `requireReviewer` is from `@/lib/attend/identity/roles`. `writeAuditLog` is from `@/lib/attend/audit/audit-log`.
- Schema facts (migration 008/011/012): `attend_disputes` columns — `id, payment_id, order_id, event_id, stripe_dispute_id (unique), reason, amount_cents, status (attend_dispute_status default NEEDS_RESPONSE), evidence_packet_id (FK), due_by, created_at, updated_at`. Enum `attend_dispute_status` = `NEEDS_RESPONSE, EVIDENCE_BUILDING, EVIDENCE_READY, SUBMITTED, WON, LOST, ACCEPTED, EXPIRED, ESCALATED`. `attend_ledger_entry_type` includes `DISPUTE_HOLD` and `CHARGEBACK_DEBIT`. `attend_order_status` includes `DISPUTED`. `attend_evidence_packets` supports `subject_type='DISPUTE'` and a no-FK `dispute_id`. `attend_payments` rows of `kind='TICKET_PURCHASE'` carry `stripe_payment_intent_id`.

---

### Task 1: Dispute recommendation rules

The §18 centerpiece — a pure function that recommends whether to contest a dispute, plus a deadline check. Both pure and unit-tested.

**Files:**
- Create: `src/lib/attend/disputes/dispute-recommendation.ts`
- Test: `src/lib/attend/disputes/dispute-recommendation.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/attend/disputes/dispute-recommendation.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  recommendDisputeResponse,
  isDisputeDueSoon,
  type DisputeEvidence,
} from '@/lib/attend/disputes/dispute-recommendation'

const base: DisputeEvidence = {
  eventCancelled: false,
  artistNoShow: false,
  anyAttended: false,
  eventEnded: false,
}

describe('recommendDisputeResponse', () => {
  it('accepts a dispute on a cancelled event — there is no case to make', () => {
    expect(recommendDisputeResponse({ ...base, eventCancelled: true })).toBe('ACCEPT')
  })

  it('accepts a dispute when the artist no-showed', () => {
    expect(recommendDisputeResponse({ ...base, artistNoShow: true, eventEnded: true })).toBe(
      'ACCEPT',
    )
  })

  it('contests a dispute when the buyer attended the show', () => {
    expect(recommendDisputeResponse({ ...base, anyAttended: true, eventEnded: true })).toBe(
      'CONTEST',
    )
  })

  it('contests a dispute when the event ran and the buyer simply did not attend', () => {
    expect(recommendDisputeResponse({ ...base, eventEnded: true })).toBe('CONTEST')
  })

  it('sends an upcoming event to human review', () => {
    expect(recommendDisputeResponse(base)).toBe('NEEDS_HUMAN')
  })

  it('lets a cancelled event override attendance', () => {
    expect(
      recommendDisputeResponse({ ...base, eventCancelled: true, anyAttended: true }),
    ).toBe('ACCEPT')
  })
})

describe('isDisputeDueSoon', () => {
  const now = new Date('2026-05-19T12:00:00Z')

  it('is true when the deadline is within 48 hours', () => {
    expect(isDisputeDueSoon('2026-05-20T12:00:00Z', now)).toBe(true)
  })

  it('is false when the deadline is comfortably away', () => {
    expect(isDisputeDueSoon('2026-05-25T12:00:00Z', now)).toBe(false)
  })

  it('is false when there is no deadline', () => {
    expect(isDisputeDueSoon(null, now)).toBe(false)
  })

  it('is true when the deadline has already passed', () => {
    expect(isDisputeDueSoon('2026-05-18T12:00:00Z', now)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/attend/disputes/dispute-recommendation.test.ts`
Expected: FAIL — cannot resolve the module.

- [ ] **Step 3: Write the implementation**

Create `src/lib/attend/disputes/dispute-recommendation.ts`:

```ts
// HYVE Attend dispute recommendation — the spec §18 contest/accept rules as a
// pure function, plus a deadline check. Advisory only: a reviewer always makes
// the final call (a dispute carries a hard card-network deadline, so the
// recommendation exists to help them triage, not to act on its own).

export type DisputeResponse = 'CONTEST' | 'ACCEPT' | 'NEEDS_HUMAN'

export interface DisputeEvidence {
  /** The event was cancelled — the buyer was owed their money. */
  eventCancelled: boolean
  /** The show is over and the stream never went live. */
  artistNoShow: boolean
  /** At least one ticket on the order was checked in / watched. */
  anyAttended: boolean
  /** The event has already finished. */
  eventEnded: boolean
}

// A dispute is "due soon" within this window of its card-network deadline.
const DUE_SOON_MS = 48 * 60 * 60 * 1000

/**
 * Recommend a response to a card dispute from its evidence.
 *  - CONTEST     — the buyer received the show; we have a case worth fighting.
 *  - ACCEPT      — the event failed to happen; contesting would only lose.
 *  - NEEDS_HUMAN — ambiguous; a reviewer must weigh it (the default).
 */
export function recommendDisputeResponse(e: DisputeEvidence): DisputeResponse {
  // The event did not deliver — there is no evidence to win on.
  if (e.eventCancelled || e.artistNoShow) return 'ACCEPT'

  // The buyer attended, or the event ran normally and they simply did not.
  if (e.anyAttended) return 'CONTEST'
  if (e.eventEnded) return 'CONTEST'

  // Upcoming event, or anything the rules above do not settle.
  return 'NEEDS_HUMAN'
}

/** True when the dispute's card-network deadline is within 48 hours (or past). */
export function isDisputeDueSoon(dueBy: string | null, now: Date = new Date()): boolean {
  if (!dueBy) return false
  return new Date(dueBy).getTime() - now.getTime() <= DUE_SOON_MS
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/attend/disputes/dispute-recommendation.test.ts`
Expected: PASS — 10/10.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/attend/disputes/dispute-recommendation.ts src/lib/attend/disputes/dispute-recommendation.test.ts
git commit -m "feat(attend): add dispute recommendation rules (Phase 6c task 1)"
```

---

### Task 2: Migration 028 — the dispute RPCs

Two atomic writes. `attend_open_dispute` records a new dispute, freezes the order (`DISPUTED`), and posts a temporary `DISPUTE_HOLD` ledger entry — idempotent on `stripe_dispute_id`. `attend_close_dispute` resolves a dispute `WON`/`LOST`, always releases the hold, and on `LOST` posts the real `CHARGEBACK_DEBIT` — idempotent once closed.

**Files:**
- Create: `supabase/migrations/028_attend_disputes.sql`

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/028_attend_disputes.sql`:

```sql
-- HYVE Attend — the two card-dispute RPCs (spec §18). Both are driven by the
-- Stripe webhook, so both are idempotent against a retried delivery.
--
-- attend_open_dispute records a new dispute, freezes the order (-> DISPUTED),
-- and posts a temporary DISPUTE_HOLD ledger entry (the disputed amount leaves
-- the artist's pending net while the dispute is open). Idempotent on the
-- unique stripe_dispute_id.
create or replace function attend_open_dispute(p_args jsonb)
returns jsonb language plpgsql as $$
declare
  v_stripe_id  text := p_args->>'stripe_dispute_id';
  v_payment_id uuid := (p_args->>'payment_id')::uuid;
  v_order_id   uuid := (p_args->>'order_id')::uuid;
  v_event_id   uuid := (p_args->>'event_id')::uuid;
  v_amount     int  := (p_args->>'amount_cents')::int;
  v_reason     text := nullif(p_args->>'reason', '');
  v_due_by     timestamptz := nullif(p_args->>'due_by', '')::timestamptz;
  v_existing   uuid;
  v_dispute_id uuid;
  v_order      attend_orders%rowtype;
begin
  -- Idempotent: a retried webhook for the same Stripe dispute is a no-op.
  select id into v_existing from attend_disputes where stripe_dispute_id = v_stripe_id;
  if v_existing is not null then
    return jsonb_build_object('dispute_id', v_existing, 'already_done', true);
  end if;

  select * into v_order from attend_orders where id = v_order_id for update;

  insert into attend_disputes
    (payment_id, order_id, event_id, stripe_dispute_id, reason, amount_cents,
     status, due_by)
  values
    (v_payment_id, v_order_id, v_event_id, v_stripe_id, v_reason, v_amount,
     'NEEDS_RESPONSE', v_due_by)
  returning id into v_dispute_id;

  -- Freeze the order (§18). The refund RPC already refuses a disputed order.
  if v_order.id is not null then
    update attend_orders set status = 'DISPUTED', updated_at = now()
     where id = v_order_id;
  end if;

  -- Temporary ledger hold: the disputed amount leaves the artist's pending net
  -- until the dispute closes (attend_close_dispute releases it either way).
  insert into attend_ledger_entries
    (event_id, order_id, payment_id, type, amount_cents, currency, description, source)
  values
    (v_event_id, v_order_id, v_payment_id, 'DISPUTE_HOLD', -v_amount,
     coalesce(v_order.currency, 'usd'), 'Funds held — card dispute opened', 'SYSTEM');

  return jsonb_build_object('dispute_id', v_dispute_id);
end $$;

-- attend_close_dispute resolves a dispute. It ALWAYS releases the temporary
-- DISPUTE_HOLD (so the two DISPUTE_HOLD entries net to zero); a WON dispute
-- returns the order to PAID, a LOST dispute additionally posts the real,
-- permanent CHARGEBACK_DEBIT. Idempotent once the dispute is WON/LOST.
create or replace function attend_close_dispute(p_args jsonb)
returns jsonb language plpgsql as $$
declare
  v_stripe_id text := p_args->>'stripe_dispute_id';
  v_outcome   text := p_args->>'outcome';
  v_dispute   attend_disputes%rowtype;
  v_currency  text;
begin
  select * into v_dispute from attend_disputes
   where stripe_dispute_id = v_stripe_id for update;
  if v_dispute.id is null then
    -- A dispute we never recorded (no matching Attend payment at creation):
    -- a structured result, not an exception, so the webhook does not retry.
    return jsonb_build_object('ok', false, 'error', 'dispute not recorded');
  end if;
  if v_dispute.status in ('WON', 'LOST') then
    return jsonb_build_object('dispute_id', v_dispute.id,
      'status', v_dispute.status, 'already_done', true);
  end if;
  if v_outcome not in ('WON', 'LOST') then
    raise exception 'attend_close_dispute: bad outcome %', v_outcome;
  end if;

  select currency into v_currency from attend_orders
   where id = v_dispute.order_id for update;
  v_currency := coalesce(v_currency, 'usd');

  update attend_disputes set status = v_outcome, updated_at = now()
   where id = v_dispute.id;

  -- Release the temporary hold posted at open (the DISPUTE_HOLD pair nets to 0).
  insert into attend_ledger_entries
    (event_id, order_id, payment_id, type, amount_cents, currency, description, source)
  values
    (v_dispute.event_id, v_dispute.order_id, v_dispute.payment_id, 'DISPUTE_HOLD',
     v_dispute.amount_cents, v_currency, 'Card dispute closed — hold released', 'SYSTEM');

  if v_outcome = 'WON' then
    -- We kept the funds: lift the freeze, the order returns to PAID.
    update attend_orders set status = 'PAID', updated_at = now()
     where id = v_dispute.order_id and status = 'DISPUTED';
  else
    -- LOST: the chargeback stands — the money is gone for good.
    insert into attend_ledger_entries
      (event_id, order_id, payment_id, type, amount_cents, currency, description, source)
    values
      (v_dispute.event_id, v_dispute.order_id, v_dispute.payment_id, 'CHARGEBACK_DEBIT',
       -v_dispute.amount_cents, v_currency, 'Dispute lost — chargeback', 'SYSTEM');
  end if;

  return jsonb_build_object('dispute_id', v_dispute.id, 'status', v_outcome);
end $$;
```

- [ ] **Step 2: Apply the migration**

Apply with the Supabase MCP `apply_migration` tool — project ref `jlyqezwuyhfevrdomazd`, name `attend_disputes`, contents = the file above.

- [ ] **Step 3: Verify the migration applied**

Run with the Supabase MCP `execute_sql` tool:

```sql
select
  (select count(*) from pg_proc where proname = 'attend_open_dispute') as open_fn,
  (select count(*) from pg_proc where proname = 'attend_close_dispute') as close_fn;
```

Expected: one row, `open_fn = 1`, `close_fn = 1`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/028_attend_disputes.sql
git commit -m "feat(attend): add the card-dispute RPCs (Phase 6c task 2)"
```

---

### Task 3: Dispute repository

Raw-REST data access for `attend_disputes`, the order-scoped evidence bundle, the payment lookup by PaymentIntent, and the evidence-packet insert. Modelled on `src/lib/attend/refunds/refund-repository.ts`.

**Files:**
- Create: `src/lib/attend/disputes/dispute-repository.ts`

- [ ] **Step 1: Write the repository**

Create `src/lib/attend/disputes/dispute-repository.ts`:

```ts
// Raw-REST data access for the HYVE Attend dispute tables. Query-only — no
// business logic. Server-side only (service-key reads).
import { supaGet, supaPost, supaPatch } from '@/lib/supabase'

export interface DisputeRow {
  id: string
  payment_id: string
  order_id: string
  event_id: string
  stripe_dispute_id: string
  reason: string | null
  status: string
  amount_cents: number
  evidence_packet_id: string | null
  due_by: string | null
  created_at: string
}

// One row of the admin dispute queue, with display context embedded.
export interface DisputeQueueRow {
  id: string
  status: string
  reason: string | null
  amount_cents: number
  due_by: string | null
  created_at: string
  evidence_packet_id: string | null
  attend_events: { title: string } | null
}

// The order-scoped evidence bundle: the order with its event + stream and
// every ticket (plus attendance and transfers) embedded via PostgREST joins.
export interface OrderEvidenceBundle {
  id: string
  status: string
  total_cents: number
  currency: string
  created_at: string
  policy_snapshot: Record<string, unknown>
  stripe_payment_intent_id: string | null
  buyer_id: string
  attend_events: {
    id: string
    title: string
    status: string
    starts_at: string | null
    ends_at: string | null
    attend_streams: { status: string; started_at: string | null; ended_at: string | null }[]
  }
  attend_tickets: {
    id: string
    state: string
    checked_in_at: string | null
    attend_attendance_sessions: {
      joined_at: string
      left_at: string | null
      watch_seconds: number
      device: string | null
      browser: string | null
      ip_hash: string | null
    }[]
    attend_ticket_transfers: { method: string; status: string; created_at: string }[]
  }[]
}

/** The TICKET_PURCHASE payment for a Stripe PaymentIntent (the disputed charge). */
export async function findPaymentByIntent(
  paymentIntentId: string,
): Promise<{ id: string; order_id: string | null; event_id: string | null } | null> {
  const res = await supaGet(
    'attend_payments',
    `stripe_payment_intent_id=eq.${paymentIntentId}&kind=eq.TICKET_PURCHASE` +
      `&select=id,order_id,event_id`,
  )
  if (!res.ok) throw new Error(`attend_payments query failed: ${res.status}`)
  const rows = (await res.json()) as { id: string; order_id: string | null; event_id: string | null }[]
  return rows[0] ?? null
}

export async function getDisputeById(id: string): Promise<DisputeRow | null> {
  const res = await supaGet('attend_disputes', `id=eq.${id}&select=*`)
  if (!res.ok) throw new Error(`attend_disputes query failed: ${res.status}`)
  const rows = (await res.json()) as DisputeRow[]
  return rows[0] ?? null
}

/** Every dispute, newest first — the admin queue (closed disputes included for history). */
export async function listDisputes(): Promise<DisputeQueueRow[]> {
  const res = await supaGet(
    'attend_disputes',
    `select=id,status,reason,amount_cents,due_by,created_at,evidence_packet_id,` +
      `attend_events(title)&order=created_at.desc`,
  )
  if (!res.ok) throw new Error(`attend_disputes queue query failed: ${res.status}`)
  return (await res.json()) as DisputeQueueRow[]
}

/** One order with its event, stream, tickets, attendance and transfers embedded. */
export async function getOrderEvidenceBundle(
  orderId: string,
): Promise<OrderEvidenceBundle | null> {
  const res = await supaGet(
    'attend_orders',
    `id=eq.${orderId}&select=id,status,total_cents,currency,created_at,policy_snapshot,` +
      `stripe_payment_intent_id,buyer_id,` +
      `attend_events(id,title,status,starts_at,ends_at,` +
      `attend_streams(status,started_at,ended_at)),` +
      `attend_tickets(id,state,checked_in_at,` +
      `attend_attendance_sessions(joined_at,left_at,watch_seconds,device,browser,ip_hash),` +
      `attend_ticket_transfers(method,status,created_at))`,
  )
  if (!res.ok) throw new Error(`attend_orders evidence query failed: ${res.status}`)
  const rows = (await res.json()) as OrderEvidenceBundle[]
  return rows[0] ?? null
}

/** Insert the §18 evidence packet for a dispute; returns its id. */
export async function insertDisputeEvidencePacket(args: {
  disputeId: string
  payload: Record<string, unknown>
}): Promise<{ id: string }> {
  const res = await supaPost(
    'attend_evidence_packets',
    { subject_type: 'DISPUTE', dispute_id: args.disputeId, payload: args.payload },
    'return=representation',
  )
  if (!res.ok) {
    throw new Error(`attend_evidence_packets insert failed: ${res.status} ${await res.text()}`)
  }
  const rows = (await res.json()) as { id: string }[]
  if (rows.length === 0) throw new Error('attend_evidence_packets insert returned no row')
  return rows[0]
}

export async function updateDispute(
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const res = await supaPatch('attend_disputes', `id=eq.${id}`, {
    ...patch,
    updated_at: new Date().toISOString(),
  })
  if (!res.ok) {
    throw new Error(`attend_disputes update failed: ${res.status} ${await res.text()}`)
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/attend/disputes/dispute-repository.ts
git commit -m "feat(attend): add dispute repository (Phase 6c task 3)"
```

---

### Task 4: Dispute evidence builder

Assembles the §18 evidence packet for a disputed order: a rich JSON payload plus the `DisputeEvidence` flags the §18 rules consume. The fetch (`buildDisputeEvidence`) and the derivation (`deriveDisputeEvidence`) are split so the derivation stays a small, readable pure function. Modelled on `src/lib/attend/refunds/evidence-builder.ts`.

**Files:**
- Create: `src/lib/attend/disputes/dispute-evidence-builder.ts`

- [ ] **Step 1: Write the evidence builder**

Create `src/lib/attend/disputes/dispute-evidence-builder.ts`:

```ts
// HYVE Attend dispute evidence — assembles the §18 evidence packet for a
// disputed order: a rich JSON payload (stored on attend_evidence_packets) plus
// the boolean flags the §18 contest/accept rules consume.
import type { DisputeEvidence } from '@/lib/attend/disputes/dispute-recommendation'
import {
  getOrderEvidenceBundle,
  type OrderEvidenceBundle,
} from '@/lib/attend/disputes/dispute-repository'

// Event statuses that mean the show is over.
const ENDED_STATUSES = ['ENDED', 'SETTLEMENT_HOLD', 'SETTLED', 'REFUNDING', 'ARCHIVED']
// Ticket states that mean the holder reached the room.
const ATTENDED_STATES = ['CHECKED_IN', 'IN_ROOM', 'USED']

export interface DisputeEvidenceResult {
  flags: DisputeEvidence
  payload: Record<string, unknown>
}

/** Fetch the order's evidence bundle and derive its packet + flags. */
export async function buildDisputeEvidence(orderId: string): Promise<DisputeEvidenceResult> {
  const bundle = await getOrderEvidenceBundle(orderId)
  if (!bundle) throw new Error(`dispute evidence: order ${orderId} not found`)
  return deriveDisputeEvidence(bundle)
}

/** Pure: an order evidence bundle -> the §18 payload and the §18 rule flags. */
export function deriveDisputeEvidence(b: OrderEvidenceBundle): DisputeEvidenceResult {
  const event = b.attend_events
  const stream = event.attend_streams[0] ?? null
  const tickets = b.attend_tickets ?? []

  const eventEnded = ENDED_STATUSES.includes(event.status)
  const anyAttended = tickets.some(
    (t) =>
      t.checked_in_at != null ||
      ATTENDED_STATES.includes(t.state) ||
      (t.attend_attendance_sessions ?? []).length > 0,
  )

  const flags: DisputeEvidence = {
    eventCancelled: event.status === 'CANCELLED',
    artistNoShow: eventEnded && stream != null && stream.started_at == null,
    anyAttended,
    eventEnded,
  }

  const payload: Record<string, unknown> = {
    order: {
      id: b.id,
      status: b.status,
      total_cents: b.total_cents,
      currency: b.currency,
      created_at: b.created_at,
      buyer_id: b.buyer_id,
      stripe_payment_intent_id: b.stripe_payment_intent_id,
    },
    event: {
      id: event.id,
      title: event.title,
      status: event.status,
      starts_at: event.starts_at,
      ends_at: event.ends_at,
    },
    stream,
    tickets: tickets.map((t) => ({
      id: t.id,
      state: t.state,
      checked_in_at: t.checked_in_at,
      attendance: t.attend_attendance_sessions ?? [],
      transfers: t.attend_ticket_transfers ?? [],
    })),
    policy_snapshot: b.policy_snapshot,
    evidence_flags: flags,
    proof_event_occurred: eventEnded,
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
git add src/lib/attend/disputes/dispute-evidence-builder.ts
git commit -m "feat(attend): add dispute evidence builder (Phase 6c task 4)"
```

---

### Task 5: Dispute service

The orchestration. `ingestDisputeCreated` / `ingestDisputeClosed` are called by the webhook; `getDisputeQueue` feeds the admin page; `submitDisputeEvidence` pushes the evidence text to Stripe and `acceptDispute` concedes the dispute.

**Files:**
- Create: `src/lib/attend/disputes/dispute-service.ts`

- [ ] **Step 1: Write the service**

Create `src/lib/attend/disputes/dispute-service.ts`:

```ts
// HYVE Attend disputes — card-dispute orchestration (spec §18). Ingestion is
// webhook-driven: a created dispute is recorded and frozen atomically
// (attend_open_dispute), then evidence is built and a contest/accept
// recommendation attached. A reviewer then submits evidence to Stripe or
// concedes; Stripe's charge.dispute.closed webhook records the final outcome.
import type Stripe from 'stripe'
import { attendStripe } from '@/lib/attend/payments/stripe'
import { recommendDisputeResponse } from '@/lib/attend/disputes/dispute-recommendation'
import { buildDisputeEvidence } from '@/lib/attend/disputes/dispute-evidence-builder'
import {
  findPaymentByIntent,
  getDisputeById,
  listDisputes,
  insertDisputeEvidencePacket,
  updateDispute,
  type DisputeQueueRow,
} from '@/lib/attend/disputes/dispute-repository'
import { ValidationError, NotFoundError } from '@/lib/attend/events/service'
import { supaPost } from '@/lib/supabase'

export type { DisputeQueueRow }

// Dispute statuses from which a reviewer may still act.
const OPEN_STATUSES = ['NEEDS_RESPONSE', 'EVIDENCE_BUILDING', 'EVIDENCE_READY', 'ESCALATED']

/**
 * Record a newly-created Stripe dispute: open it atomically (freeze the order +
 * ledger hold), then best-effort build the §18 evidence packet and attach a
 * recommendation. A dispute with no matching payment is logged and skipped —
 * it is not one of ours.
 */
export async function ingestDisputeCreated(dispute: Stripe.Dispute): Promise<void> {
  const paymentIntentId =
    typeof dispute.payment_intent === 'string'
      ? dispute.payment_intent
      : (dispute.payment_intent?.id ?? null)
  if (!paymentIntentId) {
    console.error(`[attend dispute] ${dispute.id} has no payment_intent — skipped`)
    return
  }
  const payment = await findPaymentByIntent(paymentIntentId)
  if (!payment || !payment.order_id || !payment.event_id) {
    console.error(`[attend dispute] ${dispute.id}: no matching Attend payment — skipped`)
    return
  }

  const dueBy = dispute.evidence_details?.due_by
    ? new Date(dispute.evidence_details.due_by * 1000).toISOString()
    : null

  const res = await supaPost('rpc/attend_open_dispute', {
    p_args: {
      stripe_dispute_id: dispute.id,
      payment_id: payment.id,
      order_id: payment.order_id,
      event_id: payment.event_id,
      amount_cents: dispute.amount,
      reason: dispute.reason ?? null,
      due_by: dueBy,
    },
  })
  if (!res.ok) {
    throw new Error(`attend_open_dispute RPC failed: ${res.status} ${await res.text()}`)
  }
  const { dispute_id: disputeId, already_done: alreadyDone } = (await res.json()) as {
    dispute_id: string
    already_done?: boolean
  }
  if (alreadyDone) return

  // Best-effort evidence + recommendation — a failure here leaves the dispute
  // for a reviewer without an auto-recommendation rather than failing the
  // webhook (which the order freeze has already accomplished).
  try {
    const { flags, payload } = await buildDisputeEvidence(payment.order_id)
    const recommendation = recommendDisputeResponse(flags)
    const packet = await insertDisputeEvidencePacket({
      disputeId,
      payload: { ...payload, recommendation },
    })
    await updateDispute(disputeId, {
      status: 'EVIDENCE_READY',
      evidence_packet_id: packet.id,
    })
  } catch (err) {
    console.error('[attend dispute] evidence build failed:', (err as Error).message)
  }
}

/** Record a closed Stripe dispute: WON / LOST, releasing the ledger hold. */
export async function ingestDisputeClosed(dispute: Stripe.Dispute): Promise<void> {
  const outcome = dispute.status === 'won' ? 'WON' : 'LOST'
  const res = await supaPost('rpc/attend_close_dispute', {
    p_args: { stripe_dispute_id: dispute.id, outcome },
  })
  if (!res.ok) {
    throw new Error(`attend_close_dispute RPC failed: ${res.status} ${await res.text()}`)
  }
  // A dispute we never recorded (no matching Attend payment at creation time)
  // returns { ok: false } — there is nothing to settle, so this is not an error.
  const result = (await res.json()) as { ok?: boolean }
  if (result.ok === false) {
    console.error(`[attend dispute] close for unrecorded dispute ${dispute.id} — skipped`)
  }
}

/** The admin dispute queue — every dispute, newest first. */
export async function getDisputeQueue(): Promise<DisputeQueueRow[]> {
  return listDisputes()
}

/**
 * Submit the evidence packet to Stripe and mark the dispute SUBMITTED. The
 * packet payload is sent as Stripe's uncategorized evidence text.
 */
export async function submitDisputeEvidence(disputeId: string): Promise<void> {
  const dispute = await loadOpenDispute(disputeId)

  let evidenceText = `HYVE Attend dispute evidence for order ${dispute.order_id}.`
  if (dispute.evidence_packet_id) {
    evidenceText +=
      ` Evidence packet ${dispute.evidence_packet_id} on file: attendance, ticket,` +
      ` event, stream and policy records support that the event was delivered.`
  }

  await attendStripe().disputes.update(dispute.stripe_dispute_id, {
    evidence: { uncategorized_text: evidenceText },
    submit: true,
  })
  await updateDispute(dispute.id, { status: 'SUBMITTED' })
}

/** Concede the dispute: close it with Stripe and mark it ACCEPTED. */
export async function acceptDispute(disputeId: string): Promise<void> {
  const dispute = await loadOpenDispute(disputeId)
  await attendStripe().disputes.close(dispute.stripe_dispute_id)
  await updateDispute(dispute.id, { status: 'ACCEPTED' })
}

async function loadOpenDispute(disputeId: string) {
  const dispute = await getDisputeById(disputeId)
  if (!dispute) throw new NotFoundError('Dispute not found')
  if (!OPEN_STATUSES.includes(dispute.status)) {
    throw new ValidationError('This dispute can no longer be acted on')
  }
  return dispute
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/attend/disputes/dispute-service.ts
git commit -m "feat(attend): add dispute service (Phase 6c task 5)"
```

---

### Task 6: Webhook wiring + admin dispute route

Wire the two `charge.dispute.*` events into the Attend Stripe webhook, and add the admin action route.

**Files:**
- Modify: `src/app/api/attend/webhooks/stripe/route.ts`
- Create: `src/app/api/attend/admin/disputes/[id]/route.ts`

- [ ] **Step 1: Wire the webhook**

In `src/app/api/attend/webhooks/stripe/route.ts`, add the import and the two branches.

Add to the import block (after the `connect-service` import):

```ts
import { ingestDisputeCreated, ingestDisputeClosed } from '@/lib/attend/disputes/dispute-service'
```

Extend the `if / else if` chain in the `try` block — after the `account.updated` branch, before its closing `}`:

```ts
    } else if (event.type === 'account.updated') {
      await syncAccountStatus((event.data.object as Stripe.Account).id)
    } else if (event.type === 'charge.dispute.created') {
      await ingestDisputeCreated(event.data.object as Stripe.Dispute)
    } else if (event.type === 'charge.dispute.closed') {
      await ingestDisputeClosed(event.data.object as Stripe.Dispute)
    }
```

- [ ] **Step 2: Write the admin action route**

Create `src/app/api/attend/admin/disputes/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { requireReviewer } from '@/lib/attend/identity/roles'
import { submitDisputeEvidence, acceptDispute } from '@/lib/attend/disputes/dispute-service'
import { NotFoundError, ValidationError } from '@/lib/attend/events/service'
import { writeAuditLog } from '@/lib/attend/audit/audit-log'

export const runtime = 'nodejs'

// POST /api/attend/admin/disputes/[id] — submit evidence to Stripe or concede a
// dispute. Body: { action: 'submit' | 'accept' }. ADMIN/REVIEWER only.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const reviewer = await requireReviewer()
  if (!reviewer) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  let body: { action?: unknown }
  try {
    body = (await req.json()) as { action?: unknown }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (body.action !== 'submit' && body.action !== 'accept') {
    return NextResponse.json({ error: 'action must be submit or accept' }, { status: 400 })
  }

  try {
    if (body.action === 'submit') {
      await submitDisputeEvidence(params.id)
    } else {
      await acceptDispute(params.id)
    }
    await writeAuditLog({
      actorId: reviewer.id,
      action: `dispute.${body.action}`,
      entityType: 'DISPUTE',
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
    console.error('[attend dispute action]:', (err as Error).message)
    return NextResponse.json({ error: 'That action could not be completed' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/attend/webhooks/stripe/route.ts" "src/app/api/attend/admin/disputes/[id]/route.ts"
git commit -m "feat(attend): wire dispute webhooks + admin action route (Phase 6c task 6)"
```

---

### Task 7: Admin dispute queue page + nav

A new page at `/attend/admin/disputes` listing every dispute with its status, amount, deadline urgency, and a submit/accept control for open ones. A "Disputes" link is added to the Attend admin nav.

**Files:**
- Create: `src/app/attend/admin/disputes/page.tsx`
- Create: `src/app/attend/admin/disputes/dispute-action-client.tsx`
- Modify: `src/app/attend/admin/layout.tsx` (add the nav link)

- [ ] **Step 1: Write the action client**

Create `src/app/attend/admin/disputes/dispute-action-client.tsx`:

```tsx
'use client'

import { useState } from 'react'

const btn = 'rounded px-3 py-1.5 text-xs font-bold transition disabled:opacity-50'

export default function DisputeActionClient({ disputeId }: { disputeId: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function act(action: 'submit' | 'accept') {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/attend/admin/disputes/${disputeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        window.location.reload()
        return
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      setError(data.error ?? 'That action could not be completed')
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
          onClick={() => act('submit')}
          disabled={busy}
          className={`${btn} bg-[#E8C456] text-black hover:brightness-110`}
        >
          Submit evidence
        </button>
        <button
          onClick={() => act('accept')}
          disabled={busy}
          className={`${btn} border border-[#2a2135] text-[#9e8a55] hover:text-red-400`}
        >
          Concede
        </button>
      </div>
      {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Write the queue page**

Create `src/app/attend/admin/disputes/page.tsx`:

```tsx
import { getDisputeQueue } from '@/lib/attend/disputes/dispute-service'
import { isDisputeDueSoon } from '@/lib/attend/disputes/dispute-recommendation'
import DisputeActionClient from './dispute-action-client'

export const metadata = { title: 'Disputes — Attend admin' }
export const dynamic = 'force-dynamic'

const OPEN_STATUSES = ['NEEDS_RESPONSE', 'EVIDENCE_BUILDING', 'EVIDENCE_READY', 'ESCALATED']
const usd = (c: number) => `$${(c / 100).toFixed(2)}`
const fmtWhen = (iso: string | null) => (iso ? iso.slice(0, 16).replace('T', ' ') : '—')

export default async function DisputeQueuePage() {
  const disputes = await getDisputeQueue()

  return (
    <div>
      <h2 className="text-xs font-black tracking-[0.2em] text-[#9e8a55]">CARD DISPUTES</h2>
      {disputes.length === 0 ? (
        <p className="mt-3 text-sm text-[#9e8a55]">No disputes.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {disputes.map((d) => {
            const open = OPEN_STATUSES.includes(d.status)
            const dueSoon = open && isDisputeDueSoon(d.due_by)
            return (
              <li
                key={d.id}
                className="flex items-start justify-between gap-3 rounded border border-[#2a2135] bg-[#111111] px-4 py-3"
              >
                <div>
                  <span className="text-sm font-bold">
                    {d.attend_events?.title ?? 'Event'}
                  </span>
                  <p className="text-xs text-[#9e8a55]">
                    {usd(d.amount_cents)} · {d.reason ?? 'no reason given'}
                  </p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#9e8a55]">
                    {d.status}
                    {d.due_by && (
                      <span className={dueSoon ? 'text-red-400' : 'text-[#9e8a55]'}>
                        {' '}
                        · responds by {fmtWhen(d.due_by)}
                        {dueSoon ? ' (due soon)' : ''}
                      </span>
                    )}
                  </p>
                </div>
                {open && <DisputeActionClient disputeId={d.id} />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Add the nav link**

In `src/app/attend/admin/layout.tsx`, add a third link to the `<nav>` block, after the Refunds link:

```tsx
        <Link href="/attend/admin/refunds" className={navLink}>
          Refunds
        </Link>
        <Link href="/attend/admin/disputes" className={navLink}>
          Disputes
        </Link>
```

- [ ] **Step 4: Typecheck, build, and run the test suite**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds; the route list includes `/attend/admin/disputes` and `/api/attend/admin/disputes/[id]`.

Run: `npx vitest run`
Expected: all tests pass, including `dispute-recommendation.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add "src/app/attend/admin/disputes/page.tsx" "src/app/attend/admin/disputes/dispute-action-client.tsx" "src/app/attend/admin/layout.tsx"
git commit -m "feat(attend): add admin dispute queue + nav (Phase 6c task 7)"
```

---

## Verification & acceptance

After all tasks, confirm:

- `npx tsc --noEmit`, `npx vitest run`, and `npm run build` all pass.
- Migration 028 is applied (the Task 2 probe).
- The §18 flow is reachable: a Stripe `charge.dispute.created` → `attend_open_dispute` (order frozen, ledger hold) → evidence packet + recommendation → admin queue → submit evidence / concede → Stripe `charge.dispute.closed` → `attend_close_dispute` (hold released; `CHARGEBACK_DEBIT` on loss).
- Isolation holds: `git diff main --stat` shows only new files plus the two Attend-owned files (`webhooks/stripe/route.ts`, `admin/layout.tsx`).

**Deferred to later phases (out of scope for 6c):**
- Payouts / settlement and the actual payout freeze — Phase 6d (6d's payout-release logic will check for open `attend_disputes`).
- Risk-rule tuning from dispute outcomes (§18 "use it to tune fraud rules") — Phase 6e.
- A ticket-state freeze on dispute (transfers locked on a disputed order, §6) — the order-level `DISPUTED` status plus the refund RPC's existing dispute guard are the MVP freeze; a transfer-RPC dispute guard is a small follow-up.
- Structured per-field Stripe evidence (receipt/customer-communication fields) — 6c submits the evidence as Stripe's `uncategorized_text`; richer field mapping is a later refinement.
- `EXPIRED` handling on a missed deadline and a real escalation timer.
