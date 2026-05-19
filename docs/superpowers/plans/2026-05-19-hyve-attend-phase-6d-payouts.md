# HYVE Attend Phase 6d: Payouts & Settlement — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After an event ends, hold the artist's net in settlement for a configured period, then release it as a real Stripe Connect transfer — automatically, on a schedule, skipping any event with an unresolved dispute.

**Architecture:** A new isolated `src/lib/attend/payouts/` module. The artist-net calculation is one pure, unit-tested function over the ledger. Two atomic Postgres RPCs do the multi-table money writes: `attend_settle_event` and `attend_release_payout` (migration 030; the latter replaces the migration-014 stub). A single cron-gated job route runs two passes — settle newly-ENDED events, then release matured held payouts. The creator gets a read-only payouts page. The settlement→release flow is decoupled from streaming/events: it reads their state, it does not import their modules.

**Tech Stack:** Next.js 14 App Router, TypeScript (strict), Supabase raw-REST + plpgsql RPCs, Stripe Connect (test mode), Vitest.

---

## Chunk 1: Payouts & settlement end to end

### Scope & isolation

Phase 6d is purely additive. Every file below is new except one Attend-owned file authored in an earlier Attend phase: `src/app/attend/(creator)/creator/page.tsx` (a "View payouts" link added). No pre-existing non-Attend file is touched. Migration 030 is a new file.

**Scope boundary:** 6d handles settlement and *normal* payout release. It does NOT build risk-based hold extension or fraud scoring (Phase 6e) — the hold is a flat period plus the open-dispute check. Event-cancellation bulk refunds (`attend_cancel_event_refunds`) remain a separate later concern. A genuine Stripe transfer failure or a not-yet-ready Connect account leaves the payout `HELD` to retry on the next job run (a retry cap → `FAILED` is deferred).

### File Structure

**New files:**

- `supabase/migrations/030_attend_payouts.sql` — the `attend_settle_event` and `attend_release_payout` RPCs.
- `src/lib/attend/payouts/settlement-math.ts` + `.test.ts` — the pure artist-net calculation.
- `src/lib/attend/payouts/payouts-repository.ts` — raw-REST data access for `attend_payouts`, the event ledger, and the creator's Connect account.
- `src/lib/attend/payouts/settlement-service.ts` — orchestration: settle ended events, release matured payouts, the creator's payout list.
- `src/app/api/attend/jobs/settlement/route.ts` — the cron-gated settlement job (two passes).
- `src/app/attend/(creator)/creator/payouts/page.tsx` — the creator's read-only payouts page.

**Modified file (Attend-owned, authored in an earlier phase):**

- `src/app/attend/(creator)/creator/page.tsx` — adds a "View payouts" link.

### Conventions confirmed from the codebase

- RPCs: `create or replace function attend_*(p_args jsonb) returns jsonb language plpgsql`. They `raise` on a hard programmer error (missing row) and return a jsonb object with `already_done`/`settled: false` on an idempotent replay (the `attend_complete_checkout` pattern). Applied via the Supabase MCP `apply_migration` tool — project ref `jlyqezwuyhfevrdomazd`.
- Background jobs: a `GET` route under `src/app/api/attend/jobs/`, gated by a constant-time bearer check against `ATTEND_CRON_SECRET`, returning a `{ ok, ...summary }` JSON. The job body is a service function that processes each item independently in a try/catch so one failure does not abort the run (the `cart-expiry` pattern). Idempotent — a skipped item is retried next tick.
- Only pure logic is unit-tested. Phase 6d's only test file is `settlement-math.test.ts`. Repositories/services/routes are verified by `npx tsc --noEmit` and `npm run build`.
- `attendStripe()` is from `@/lib/attend/payments/stripe`; `listEventsByStatus` from `@/lib/attend/events/repository`; `requireCreator` from `@/lib/attend/identity/roles`.
- Schema facts (migrations 008/009/011): `attend_payouts` — `id, event_id, payout_account_id (FK attend_payout_accounts), amount_cents, currency (default 'usd'), status (attend_payout_status default PENDING), hold_reason, scheduled_release_at, released_at, stripe_transfer_id, created_at, updated_at`. Enum `attend_payout_status` = `PENDING, HELD, RELEASED, FAILED`. `attend_payout_accounts` — `id, profile_id, stripe_connect_account_id (unique), status, charges_enabled, payouts_enabled`. `attend_event_status` includes `ENDED, SETTLEMENT_HOLD, SETTLED`. `attend_ledger_entries` columns: `id, event_id, order_id, payment_id, ticket_id, type, amount_cents (bigint, signed), currency, description, source, created_by, created_at` — **there is no `payout_id` column**; a payout ledger entry links by `event_id` only. `attend_ledger_entry_type` includes `PAYOUT_RELEASED`.

---

### Task 1: Settlement math

The §16/§30 centerpiece — a pure function computing the artist's net payable from an event's ledger entries. Deterministic, integer cents.

**Files:**
- Create: `src/lib/attend/payouts/settlement-math.ts`
- Test: `src/lib/attend/payouts/settlement-math.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/attend/payouts/settlement-math.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeArtistNet } from '@/lib/attend/payouts/settlement-math'

describe('computeArtistNet', () => {
  it('is zero for an empty ledger', () => {
    expect(computeArtistNet([])).toBe(0)
  })

  it('sums ARTIST_NET_PENDING entries', () => {
    expect(
      computeArtistNet([
        { type: 'ARTIST_NET_PENDING', amount_cents: 8000 },
        { type: 'ARTIST_NET_PENDING', amount_cents: 4500 },
      ]),
    ).toBe(12500)
  })

  it('subtracts refunds and chargebacks', () => {
    expect(
      computeArtistNet([
        { type: 'ARTIST_NET_PENDING', amount_cents: 10000 },
        { type: 'REFUND_DEBIT', amount_cents: -2500 },
        { type: 'CHARGEBACK_DEBIT', amount_cents: -3000 },
      ]),
    ).toBe(4500)
  })

  it('nets a closed dispute hold to zero', () => {
    expect(
      computeArtistNet([
        { type: 'ARTIST_NET_PENDING', amount_cents: 10000 },
        { type: 'DISPUTE_HOLD', amount_cents: -4000 },
        { type: 'DISPUTE_HOLD', amount_cents: 4000 },
      ]),
    ).toBe(10000)
  })

  it('reflects an open dispute hold as a reduction', () => {
    expect(
      computeArtistNet([
        { type: 'ARTIST_NET_PENDING', amount_cents: 10000 },
        { type: 'DISPUTE_HOLD', amount_cents: -4000 },
      ]),
    ).toBe(6000)
  })

  it('counts ADJUSTMENT entries', () => {
    expect(
      computeArtistNet([
        { type: 'ARTIST_NET_PENDING', amount_cents: 10000 },
        { type: 'ADJUSTMENT', amount_cents: -150 },
      ]),
    ).toBe(9850)
  })

  it('ignores gross, fee, tax, promotion and payout entries', () => {
    expect(
      computeArtistNet([
        { type: 'ARTIST_NET_PENDING', amount_cents: 7000 },
        { type: 'TICKET_GROSS', amount_cents: 10000 },
        { type: 'HYVE_PLATFORM_FEE', amount_cents: 2000 },
        { type: 'PROCESSOR_FEE_ESTIMATE', amount_cents: 600 },
        { type: 'TAX_COLLECTED', amount_cents: 400 },
        { type: 'PROMOTION_REGISTRATION_FEE', amount_cents: 5000 },
        { type: 'PAYOUT_RELEASED', amount_cents: -7000 },
      ]),
    ).toBe(7000)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/attend/payouts/settlement-math.test.ts`
Expected: FAIL — cannot resolve the module.

- [ ] **Step 3: Write the implementation**

Create `src/lib/attend/payouts/settlement-math.ts`:

```ts
// HYVE Attend settlement math — the artist's payout is the net of their
// balance-affecting ledger entries (spec §16 / §30). Pure and deterministic:
// all money is integer cents.

export interface LedgerEntry {
  type: string
  amount_cents: number
}

// The ledger entry types that make up the artist's net balance. TICKET_GROSS,
// HYVE_PLATFORM_FEE, PROCESSOR_FEE_ESTIMATE and TAX_COLLECTED are the
// accounting breakdown that ARTIST_NET_PENDING already nets out; PROMOTION_* is
// the separate registration / ad-budget flow; PAYOUT_* is the disbursement
// itself. This set MUST stay in sync with attend_settle_event's caller.
const ARTIST_NET_TYPES = new Set([
  'ARTIST_NET_PENDING',
  'REFUND_DEBIT',
  'CHARGEBACK_DEBIT',
  'DISPUTE_HOLD',
  'ADJUSTMENT',
])

/** The artist's net payable, in integer cents, from an event's ledger entries. */
export function computeArtistNet(entries: LedgerEntry[]): number {
  return entries
    .filter((e) => ARTIST_NET_TYPES.has(e.type))
    .reduce((sum, e) => sum + e.amount_cents, 0)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/attend/payouts/settlement-math.test.ts`
Expected: PASS — 7/7.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/attend/payouts/settlement-math.ts src/lib/attend/payouts/settlement-math.test.ts
git commit -m "feat(attend): add settlement math (Phase 6d task 1)"
```

---

### Task 2: Migration 030 — the settlement RPCs

`attend_settle_event` moves a finished event into settlement: with a payout owed it creates a `HELD` `attend_payouts` row and sends the event to `SETTLEMENT_HOLD`; with nothing owed (a free event, no revenue, or no Connect account) it sends the event straight to `SETTLED`. `attend_release_payout` (replacing the migration-014 stub) records a released payout: the payout → `RELEASED`, a signed `PAYOUT_RELEASED` ledger entry, and the event `SETTLEMENT_HOLD` → `SETTLED`. Both lock their target row and are idempotent.

**Files:**
- Create: `supabase/migrations/030_attend_payouts.sql`

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/030_attend_payouts.sql`:

```sql
-- HYVE Attend — the settlement RPCs (spec §16). attend_release_payout replaces
-- the migration-014 stub; attend_settle_event is new.
--
-- attend_settle_event moves a finished (ENDED) event into settlement. The
-- artist's net is computed by the TypeScript caller (settlement-math.ts) and
-- passed as amount_cents. With a positive net and a payout account on file it
-- creates a HELD payout and sends the event to SETTLEMENT_HOLD; otherwise the
-- event settles immediately (SETTLED) with no payout. Idempotent: only an
-- ENDED event is acted on.
create or replace function attend_settle_event(p_args jsonb)
returns jsonb language plpgsql as $$
declare
  v_event_id   uuid := (p_args->>'event_id')::uuid;
  v_amount     int  := (p_args->>'amount_cents')::int;
  v_event      attend_events%rowtype;
  v_account_id uuid;
  v_payout_id  uuid;
begin
  select * into v_event from attend_events where id = v_event_id for update;
  if v_event.id is null then
    raise exception 'attend_settle_event: event % not found', v_event_id;
  end if;
  if v_event.status <> 'ENDED' then
    return jsonb_build_object('event_id', v_event_id, 'settled', false,
      'reason', 'not awaiting settlement');
  end if;

  select pa.id into v_account_id
    from attend_payout_accounts pa
   where pa.profile_id = v_event.creator_id;

  -- Nothing to pay (free event / no revenue / fully refunded) or no payout
  -- account on file -> the event settles immediately with no payout row.
  if v_amount <= 0 or v_account_id is null then
    update attend_events set status = 'SETTLED', updated_at = now()
     where id = v_event_id;
    return jsonb_build_object('event_id', v_event_id, 'settled', true, 'payout', false);
  end if;

  -- A configured hold window (§16): funds rest before release.
  insert into attend_payouts
    (event_id, payout_account_id, amount_cents, status, scheduled_release_at)
  values
    (v_event_id, v_account_id, v_amount, 'HELD', now() + interval '7 days')
  returning id into v_payout_id;

  update attend_events set status = 'SETTLEMENT_HOLD', updated_at = now()
   where id = v_event_id;

  return jsonb_build_object('event_id', v_event_id, 'settled', true,
    'payout', true, 'payout_id', v_payout_id);
end $$;

-- attend_release_payout records a released payout. The Stripe Connect transfer
-- is performed by the caller before this runs (deduplicated by an idempotency
-- key); this writes the result atomically: the payout -> RELEASED, a signed
-- PAYOUT_RELEASED ledger entry, and the event -> SETTLED. Idempotent: a payout
-- already RELEASED is a safe no-op. A net-negative event (refunds exceeded
-- sales) releases $0 and leaves residual pending net in the ledger — a
-- clawback from the artist is a later concern, not a bug to "fix" here.
create or replace function attend_release_payout(p_args jsonb)
returns jsonb language plpgsql as $$
declare
  v_payout_id uuid := (p_args->>'payout_id')::uuid;
  v_amount    int  := (p_args->>'final_amount_cents')::int;
  v_transfer  text := nullif(p_args->>'stripe_transfer_id', '');
  v_payout    attend_payouts%rowtype;
begin
  select * into v_payout from attend_payouts where id = v_payout_id for update;
  if v_payout.id is null then
    raise exception 'attend_release_payout: payout % not found', v_payout_id;
  end if;
  if v_payout.status = 'RELEASED' then
    return jsonb_build_object('payout_id', v_payout_id, 'status', 'RELEASED',
      'already_done', true);
  end if;

  update attend_payouts
     set status = 'RELEASED', amount_cents = v_amount, stripe_transfer_id = v_transfer,
         released_at = now(), updated_at = now()
   where id = v_payout_id;

  -- Ledger: the payout discharges the artist's pending net (a negative entry,
  -- so the event ledger nets to zero once paid).
  insert into attend_ledger_entries
    (event_id, type, amount_cents, currency, description, source)
  values
    (v_payout.event_id, 'PAYOUT_RELEASED', -v_amount,
     coalesce(v_payout.currency, 'usd'), 'Artist payout released', 'SYSTEM');

  update attend_events set status = 'SETTLED', updated_at = now()
   where id = v_payout.event_id and status = 'SETTLEMENT_HOLD';

  return jsonb_build_object('payout_id', v_payout_id, 'status', 'RELEASED');
end $$;
```

- [ ] **Step 2: Apply the migration**

Apply with the Supabase MCP `apply_migration` tool — project ref `jlyqezwuyhfevrdomazd`, name `attend_payouts`, contents = the file above.

- [ ] **Step 3: Verify the migration applied**

Run with the Supabase MCP `execute_sql` tool:

```sql
select count(*) as ready_fns from pg_proc
 where proname in ('attend_settle_event', 'attend_release_payout')
   and prosrc not like '%not implemented%';
```

Expected: one row, `ready_fns = 2`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/030_attend_payouts.sql
git commit -m "feat(attend): add the settlement RPCs (Phase 6d task 2)"
```

---

### Task 3: Payouts repository

Raw-REST data access: the event's ledger entries, the held payouts due for release (with the Connect account embedded), the open-dispute check, and the creator's payout list. Query-only — no business logic.

**Files:**
- Create: `src/lib/attend/payouts/payouts-repository.ts`

- [ ] **Step 1: Write the repository**

Create `src/lib/attend/payouts/payouts-repository.ts`:

```ts
// Raw-REST data access for HYVE Attend payouts & settlement. Query-only — no
// business logic. Server-side only (service-key reads).
import { supaGet } from '@/lib/supabase'
import type { LedgerEntry } from '@/lib/attend/payouts/settlement-math'

// A held payout that has reached its release date, with the creator's Connect
// account embedded so the release can transfer without a second query.
export interface DuePayoutRow {
  id: string
  event_id: string
  amount_cents: number
  attend_payout_accounts: {
    stripe_connect_account_id: string
    payouts_enabled: boolean
  } | null
}

// One row of the creator's payouts page.
export interface CreatorPayoutRow {
  id: string
  amount_cents: number
  status: string
  scheduled_release_at: string | null
  released_at: string | null
  created_at: string
  attend_events: { title: string } | null
}

/** Every ledger entry for an event — fed to computeArtistNet. */
export async function getEventLedgerEntries(eventId: string): Promise<LedgerEntry[]> {
  const res = await supaGet(
    'attend_ledger_entries',
    `event_id=eq.${eventId}&select=type,amount_cents`,
  )
  if (!res.ok) throw new Error(`attend_ledger_entries query failed: ${res.status}`)
  return (await res.json()) as LedgerEntry[]
}

/** HELD payouts whose hold window has elapsed, with the Connect account embedded. */
export async function listDuePayouts(): Promise<DuePayoutRow[]> {
  const nowIso = new Date().toISOString()
  const res = await supaGet(
    'attend_payouts',
    `status=eq.HELD&scheduled_release_at=lte.${nowIso}` +
      `&select=id,event_id,amount_cents,` +
      `attend_payout_accounts(stripe_connect_account_id,payouts_enabled)`,
  )
  if (!res.ok) throw new Error(`attend_payouts due query failed: ${res.status}`)
  return (await res.json()) as DuePayoutRow[]
}

/** True if the event has a card dispute that is not yet terminally resolved. */
export async function hasOpenDispute(eventId: string): Promise<boolean> {
  const res = await supaGet(
    'attend_disputes',
    `event_id=eq.${eventId}&status=not.in.(WON,LOST)&select=id`,
  )
  if (!res.ok) throw new Error(`attend_disputes query failed: ${res.status}`)
  return ((await res.json()) as unknown[]).length > 0
}

/** The creator's payouts across all their events, newest first. */
export async function getCreatorPayouts(creatorId: string): Promise<CreatorPayoutRow[]> {
  const res = await supaGet(
    'attend_payouts',
    `select=id,amount_cents,status,scheduled_release_at,released_at,created_at,` +
      `attend_events!inner(title,creator_id)&attend_events.creator_id=eq.${creatorId}` +
      `&order=created_at.desc`,
  )
  if (!res.ok) throw new Error(`attend_payouts creator query failed: ${res.status}`)
  return (await res.json()) as CreatorPayoutRow[]
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/attend/payouts/payouts-repository.ts
git commit -m "feat(attend): add payouts repository (Phase 6d task 3)"
```

---

### Task 4: Settlement service

The orchestration. `settleEndedEvents` runs the settle pass; `releaseMaturedPayouts` runs the release pass (the Stripe transfer plus `attend_release_payout`); `getCreatorPayouts` feeds the creator page. Each item is processed in its own try/catch so one failure never aborts the run.

**Files:**
- Create: `src/lib/attend/payouts/settlement-service.ts`

- [ ] **Step 1: Write the service**

Create `src/lib/attend/payouts/settlement-service.ts`:

```ts
// HYVE Attend settlement — moves finished events through settlement and
// releases matured payouts (spec §16). Two passes, both idempotent and
// retry-safe; a payout that cannot be released yet (open dispute, Connect
// account not ready) is simply left HELD for the next run.
import { attendStripe } from '@/lib/attend/payments/stripe'
import { computeArtistNet } from '@/lib/attend/payouts/settlement-math'
import {
  getEventLedgerEntries,
  listDuePayouts,
  hasOpenDispute,
  getCreatorPayouts,
  type CreatorPayoutRow,
} from '@/lib/attend/payouts/payouts-repository'
import { listEventsByStatus } from '@/lib/attend/events/repository'
import { supaPost } from '@/lib/supabase'

export type { CreatorPayoutRow }

/** Settle pass — every ENDED event gets a HELD payout (or settles directly). */
export async function settleEndedEvents(): Promise<{ scanned: number; settled: number }> {
  const events = await listEventsByStatus('ENDED')
  let settled = 0
  for (const event of events) {
    try {
      const net = computeArtistNet(await getEventLedgerEntries(event.id))
      const res = await supaPost('rpc/attend_settle_event', {
        p_args: { event_id: event.id, amount_cents: net },
      })
      if (!res.ok) {
        console.error(
          `[settlement] attend_settle_event failed for ${event.id}: ` +
            `${res.status} ${await res.text()}`,
        )
        continue
      }
      const result = (await res.json()) as { settled?: boolean }
      if (result.settled) settled += 1
    } catch (err) {
      console.error(`[settlement] error settling ${event.id}:`, (err as Error).message)
    }
  }
  return { scanned: events.length, settled }
}

/** Release pass — pay out every matured HELD payout with no open dispute. */
export async function releaseMaturedPayouts(): Promise<{
  scanned: number
  released: number
  skipped: number
}> {
  const due = await listDuePayouts()
  let released = 0
  let skipped = 0
  for (const payout of due) {
    try {
      if (await hasOpenDispute(payout.event_id)) {
        // §16: a disputed event's funds stay held — retried once it resolves.
        skipped += 1
        continue
      }

      // Recompute the net now, so refunds / chargebacks during the hold window
      // are reflected; never transfer a negative amount.
      const net = Math.max(0, computeArtistNet(await getEventLedgerEntries(payout.event_id)))

      let transferId: string | null = null
      if (net > 0) {
        const account = payout.attend_payout_accounts
        if (!account?.payouts_enabled || !account.stripe_connect_account_id) {
          // The Connect account is not ready — leave HELD, retry next run.
          console.error(`[settlement] payout ${payout.id}: Connect account not ready`)
          skipped += 1
          continue
        }
        const transfer = await attendStripe().transfers.create(
          { amount: net, currency: 'usd', destination: account.stripe_connect_account_id },
          { idempotencyKey: `attend-payout-${payout.id}` },
        )
        transferId = transfer.id
      }

      const res = await supaPost('rpc/attend_release_payout', {
        p_args: {
          payout_id: payout.id,
          final_amount_cents: net,
          stripe_transfer_id: transferId,
        },
      })
      if (!res.ok) {
        console.error(
          `[settlement] attend_release_payout failed for ${payout.id}: ` +
            `${res.status} ${await res.text()}`,
        )
        skipped += 1
        continue
      }
      // A concurrent run may already have released it (already_done) — that is
      // not a release this run performed, so it is not counted.
      const result = (await res.json()) as { already_done?: boolean }
      if (result.already_done) skipped += 1
      else released += 1
    } catch (err) {
      console.error(`[settlement] error releasing ${payout.id}:`, (err as Error).message)
      skipped += 1
    }
  }
  return { scanned: due.length, released, skipped }
}

/** The creator's payouts, for their read-only payouts page. */
export async function listCreatorPayouts(creatorId: string): Promise<CreatorPayoutRow[]> {
  return getCreatorPayouts(creatorId)
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/attend/payouts/settlement-service.ts
git commit -m "feat(attend): add settlement service (Phase 6d task 4)"
```

---

### Task 5: Settlement job route

A cron-gated `GET` route that runs both passes. Modelled on `src/app/api/attend/jobs/cart-expiry/route.ts`.

**Files:**
- Create: `src/app/api/attend/jobs/settlement/route.ts`

- [ ] **Step 1: Write the route**

Create `src/app/api/attend/jobs/settlement/route.ts`:

```ts
import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import {
  settleEndedEvents,
  releaseMaturedPayouts,
} from '@/lib/attend/payouts/settlement-service'

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

// GET /api/attend/jobs/settlement — invoked on a schedule. Pass 1 settles
// newly-ended events; pass 2 releases matured held payouts. Bearer-secret
// gated; both passes are idempotent, so a missed item is retried next tick.
export async function GET(req: NextRequest) {
  if (!CRON_SECRET) {
    console.error('[settlement] ATTEND_CRON_SECRET not set')
    return NextResponse.json({ error: 'Cron not configured' }, { status: 500 })
  }
  if (!authorized(req.headers.get('authorization'), CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const settle = await settleEndedEvents()
    const release = await releaseMaturedPayouts()
    return NextResponse.json({ ok: true, settle, release })
  } catch (err) {
    console.error('[settlement] run failed:', (err as Error).message)
    return NextResponse.json({ error: 'Settlement run failed' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/attend/jobs/settlement/route.ts
git commit -m "feat(attend): add the settlement job route (Phase 6d task 5)"
```

---

### Task 6: Creator payouts page

A read-only page at `/attend/creator/payouts` listing the creator's payouts, with a link added to the creator home.

**Files:**
- Create: `src/app/attend/(creator)/creator/payouts/page.tsx`
- Modify: `src/app/attend/(creator)/creator/page.tsx` (add the link)

- [ ] **Step 1: Write the payouts page**

Create `src/app/attend/(creator)/creator/payouts/page.tsx`:

```tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireCreator } from '@/lib/attend/identity/roles'
import { listCreatorPayouts } from '@/lib/attend/payouts/settlement-service'

export const metadata = { title: 'Payouts — HYVE Attend' }
export const dynamic = 'force-dynamic'

const usd = (c: number) => `$${(c / 100).toFixed(2)}`
const fmtWhen = (iso: string | null) => (iso ? iso.slice(0, 10) : '—')

const statusColor: Record<string, string> = {
  HELD: 'text-[#E8C456]',
  RELEASED: 'text-green-400',
  FAILED: 'text-red-400',
  PENDING: 'text-[#9e8a55]',
}

export default async function CreatorPayoutsPage() {
  const profile = await requireCreator()
  if (!profile) redirect('/attend/login')
  const payouts = await listCreatorPayouts(profile.id)

  return (
    <div className="py-10">
      <Link href="/attend/creator" className="text-xs font-bold text-[#9e8a55] hover:text-[#E8C456]">
        ← Back to events
      </Link>
      <h1 className="mt-3 text-2xl font-black">Payouts</h1>
      <p className="mt-1 text-sm text-[#9e8a55]">
        Funds are held for a short window after each event, then released to your
        connected payout account.
      </p>

      {payouts.length === 0 ? (
        <p className="mt-6 text-sm text-[#9e8a55]">No payouts yet.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {payouts.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 rounded border border-[#2a2135] bg-[#111111] px-4 py-3"
            >
              <div>
                <span className="text-sm font-bold">{p.attend_events?.title ?? 'Event'}</span>
                <p className="text-xs text-[#9e8a55]">
                  {p.status === 'RELEASED'
                    ? `Released ${fmtWhen(p.released_at)}`
                    : `Scheduled ${fmtWhen(p.scheduled_release_at)}`}
                </p>
              </div>
              <div className="text-right">
                <span className="text-sm font-black">{usd(p.amount_cents)}</span>
                <p
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    statusColor[p.status] ?? 'text-[#9e8a55]'
                  }`}
                >
                  {p.status}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add the link to the creator home**

Replace the contents of `src/app/attend/(creator)/creator/page.tsx` with:

```tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireCreator } from '@/lib/attend/identity/roles'
import { listMyEvents } from '@/lib/attend/events/service'
import { payoutsEnabled } from '@/lib/attend/payments/connect-service'
import CreatorEventsClient from './creator-events-client'

export const metadata = { title: 'Creator — HYVE Attend' }
export const dynamic = 'force-dynamic'

export default async function CreatorPage() {
  const profile = await requireCreator()
  if (!profile) redirect('/attend/login')
  const [events, payouts] = await Promise.all([
    listMyEvents(profile.id),
    payoutsEnabled(profile.id),
  ])
  return (
    <>
      <div className="flex justify-end pt-6">
        <Link
          href="/attend/creator/payouts"
          className="text-xs font-bold text-[#9e8a55] transition hover:text-[#E8C456]"
        >
          View payouts →
        </Link>
      </div>
      <CreatorEventsClient events={events} payoutsEnabled={payouts} />
    </>
  )
}
```

- [ ] **Step 3: Typecheck, build, and run the test suite**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds; the route list includes `/attend/creator/payouts` and `/api/attend/jobs/settlement`.

Run: `npx vitest run`
Expected: all tests pass, including `settlement-math.test.ts`.

- [ ] **Step 4: Commit**

```bash
git add "src/app/attend/(creator)/creator/payouts/page.tsx" "src/app/attend/(creator)/creator/page.tsx"
git commit -m "feat(attend): add the creator payouts page (Phase 6d task 6)"
```

---

## Verification & acceptance

After all tasks, confirm:

- `npx tsc --noEmit`, `npx vitest run`, and `npm run build` all pass.
- Migration 030 is applied (the Task 2 probe).
- The §16 flow is reachable: an `ENDED` event → the settlement job → `attend_settle_event` (a `HELD` payout, event `SETTLEMENT_HOLD`) → after the hold window, the release pass → Stripe Connect transfer → `attend_release_payout` (payout `RELEASED`, `PAYOUT_RELEASED` ledger, event `SETTLED`) → visible on the creator payouts page.
- Isolation holds: `git diff main --stat` shows only new files plus the one Attend-owned file (`creator/page.tsx`).

**Deferred to later phases (out of scope for 6d):**
- Risk-based hold extension and fraud scoring (§16 "high-risk / high-fraud") — Phase 6e.
- Event-cancellation bulk refunds (`attend_cancel_event_refunds`) — a separate concern.
- A retry cap that moves a permanently-failing payout to `FAILED` — for now a transfer error or a not-ready Connect account leaves the payout `HELD` to retry.
- A clawback when refunds/chargebacks exceed an event's sales — a net-negative event releases `$0` and leaves residual `ARTIST_NET_PENDING` in the ledger; recovering it from the artist is deferred.
- A configurable (per-event / per-risk) hold period — the window is a fixed 7 days.
- Per-event payout detail on the creator event dashboard (§21 `GET /creator/events/:eventId/payouts`) — the creator-wide payouts page covers the MVP need.
