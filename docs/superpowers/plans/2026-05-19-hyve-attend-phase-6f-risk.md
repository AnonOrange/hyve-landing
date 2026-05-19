# HYVE Attend Phase 6f: Risk Scoring — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compute a risk score for an event from its observable signals (spec §26), surface the risk band to the admin reviewer, and extend the payout hold for a high-risk event (§16).

**Architecture:** A new isolated `src/lib/attend/risk/` module. The §26 scoring rules are one pure, unit-tested function. A repository gathers the computable signals; the service assembles and persists an `attend_risk_scores` row. Risk is surfaced in two places: the admin review queue (a band beside each pending event) and the settlement job (a high-risk event holds its payout longer). Signals that need data HYVE does not collect — suspicious traffic, famous-artist claims, AI likeness — are out of scope.

**Tech Stack:** Next.js 14 App Router, TypeScript (strict), Supabase raw-REST + plpgsql RPCs, Vitest.

---

## Chunk 1: Risk scoring end to end

### Scope & isolation

Phase 6f is purely additive. New files plus two Attend-owned files modified: `src/app/attend/admin/page.tsx` (a risk band per pending event) and `src/lib/attend/payouts/settlement-service.ts` (a risk-aware hold). Migration 032 redefines `attend_settle_event` (from migration 030) to accept a hold length.

**Scope boundary:** 6f computes and surfaces event risk and wires the one automated output that connects to a built system — the §16 payout-hold extension. The other §26 risk outputs (require stream test, limit ticket quantity, disable transfers, escalate refund/dispute) and all user-level risk scoring are deferred — the score informs the human reviewer, which is §26's primary "require admin approval" output.

### File Structure

**New files:**

- `supabase/migrations/032_attend_settle_event_hold.sql` — redefines `attend_settle_event` to take a `hold_days` argument.
- `src/lib/attend/risk/risk-scoring.ts` + `.test.ts` — the pure §26 event-risk scoring function.
- `src/lib/attend/risk/risk-repository.ts` — gathers an event's risk signals; persists a score row.
- `src/lib/attend/risk/risk-service.ts` — `assessEventRisk`: gather → score → persist → return.

**Modified files (both Attend-owned):**

- `src/app/attend/admin/page.tsx` — shows a risk band beside each event awaiting review.
- `src/lib/attend/payouts/settlement-service.ts` — `settleEndedEvents` assesses risk and passes a longer hold for a HIGH-risk event.

### Conventions confirmed from the codebase

- Pure logic is the only thing unit-tested. Phase 6f's test file is `risk-scoring.test.ts`.
- RPCs are `create or replace function attend_*(p_args jsonb) returns jsonb`; applied via the Supabase MCP `apply_migration` tool — project ref `jlyqezwuyhfevrdomazd`.
- `listEventsByStatus` is from `@/lib/attend/events/repository`; `getEventById` likewise.
- Schema facts: `attend_risk_scores` (migration 013) — `id, subject_type ('EVENT'/'USER'), subject_id, score (numeric), factors (jsonb), computed_at, created_at`. `attend_events` — `creator_id, starts_at, created_at, status`. `attend_ticket_types` — `event_id, price_cents`. `attend_streams` — `event_id, test_passed_at`. `attend_payout_accounts` — `profile_id, payouts_enabled`. `attend_disputes` / `attend_refund_requests` — `event_id`. `attend_settle_event` (migration 030) currently hardcodes `now() + interval '7 days'`.

---

### Task 1: Event risk scoring

The §26 centerpiece — a pure function from observable event signals to a 0-100 score, a band, and the contributing factors.

**Files:**
- Create: `src/lib/attend/risk/risk-scoring.ts`
- Test: `src/lib/attend/risk/risk-scoring.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/attend/risk/risk-scoring.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { scoreEvent, type EventRiskInput } from '@/lib/attend/risk/risk-scoring'

// An established, fully-verified, low-risk event.
const clean: EventRiskInput = {
  priorEventCount: 5,
  maxTicketPriceCents: 3000,
  streamTested: true,
  payoutVerified: true,
  priorDisputeCount: 0,
  priorRefundCount: 0,
  hoursListedToStart: 720,
}

describe('scoreEvent', () => {
  it('scores a clean established event as LOW with score 0', () => {
    const r = scoreEvent(clean)
    expect(r.score).toBe(0)
    expect(r.band).toBe('LOW')
  })

  it('adds a factor for a brand-new organizer', () => {
    const r = scoreEvent({ ...clean, priorEventCount: 0 })
    expect(r.factors.newOrganizer).toBe(20)
    expect(r.band).toBe('LOW')
  })

  it('reaches MEDIUM for a new organizer with no stream test', () => {
    const r = scoreEvent({ ...clean, priorEventCount: 0, streamTested: false })
    expect(r.score).toBe(40)
    expect(r.band).toBe('MEDIUM')
  })

  it('reaches HIGH for a new, untested, unverified event with a prior dispute', () => {
    const r = scoreEvent({
      ...clean,
      priorEventCount: 0,
      streamTested: false,
      payoutVerified: false,
      priorDisputeCount: 1,
    })
    expect(r.band).toBe('HIGH')
  })

  it('flags a high ticket price and short notice', () => {
    const r = scoreEvent({ ...clean, maxTicketPriceCents: 20000, hoursListedToStart: 12 })
    expect(r.factors.highTicketPrice).toBe(15)
    expect(r.factors.shortNotice).toBe(10)
  })

  it('scales the dispute factor but caps it', () => {
    expect(scoreEvent({ ...clean, priorDisputeCount: 1 }).factors.priorDisputes).toBe(12)
    expect(scoreEvent({ ...clean, priorDisputeCount: 9 }).factors.priorDisputes).toBe(25)
  })

  it('caps the total score at 100', () => {
    const r = scoreEvent({
      priorEventCount: 0,
      maxTicketPriceCents: 99999,
      streamTested: false,
      payoutVerified: false,
      priorDisputeCount: 20,
      priorRefundCount: 20,
      hoursListedToStart: 1,
    })
    expect(r.score).toBe(100)
    expect(r.band).toBe('HIGH')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/attend/risk/risk-scoring.test.ts`
Expected: FAIL — cannot resolve the module.

- [ ] **Step 3: Write the implementation**

Create `src/lib/attend/risk/risk-scoring.ts`:

```ts
// HYVE Attend event risk scoring — the spec §26 event-risk inputs as a pure
// function. Each observable signal contributes points; the total (capped at
// 100) maps to a band that informs the admin reviewer and the payout hold.
// §26 signals that need data HYVE does not collect (suspicious traffic,
// famous-artist claims, AI likeness) are out of scope.

export interface EventRiskInput {
  /** Events the creator has run before this one. */
  priorEventCount: number
  /** The highest ticket price on this event, in cents. */
  maxTicketPriceCents: number
  /** A stream test has passed for this event. */
  streamTested: boolean
  /** The creator's Connect account can receive payouts. */
  payoutVerified: boolean
  /** Card disputes recorded across the creator's events. */
  priorDisputeCount: number
  /** Refund requests recorded across the creator's events. */
  priorRefundCount: number
  /** Hours between the event being listed and its start time. */
  hoursListedToStart: number
}

export type RiskBand = 'LOW' | 'MEDIUM' | 'HIGH'

export interface RiskAssessment {
  score: number
  band: RiskBand
  factors: Record<string, number>
}

/** Score an event's risk from its observable signals (spec §26). */
export function scoreEvent(i: EventRiskInput): RiskAssessment {
  const factors: Record<string, number> = {}

  if (i.priorEventCount === 0) factors.newOrganizer = 20
  if (i.maxTicketPriceCents > 15000) factors.highTicketPrice = 15
  if (!i.streamTested) factors.noStreamTest = 20
  if (!i.payoutVerified) factors.payoutNotVerified = 15
  if (i.priorDisputeCount > 0) {
    factors.priorDisputes = Math.min(25, i.priorDisputeCount * 12)
  }
  if (i.priorRefundCount > 2) {
    factors.manyRefunds = Math.min(15, (i.priorRefundCount - 2) * 5)
  }
  if (i.hoursListedToStart >= 0 && i.hoursListedToStart < 48) factors.shortNotice = 10

  const score = Math.min(
    100,
    Object.values(factors).reduce((sum, v) => sum + v, 0),
  )
  const band: RiskBand = score >= 60 ? 'HIGH' : score >= 30 ? 'MEDIUM' : 'LOW'
  return { score, band, factors }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/attend/risk/risk-scoring.test.ts`
Expected: PASS — 7/7.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/attend/risk/risk-scoring.ts src/lib/attend/risk/risk-scoring.test.ts
git commit -m "feat(attend): add event risk scoring (Phase 6f task 1)"
```

---

### Task 2: Risk repository

Gathers an event's §26 risk signals from across the schema, and persists a computed score row to `attend_risk_scores`.

**Files:**
- Create: `src/lib/attend/risk/risk-repository.ts`

- [ ] **Step 1: Write the repository**

Create `src/lib/attend/risk/risk-repository.ts`:

```ts
// Raw-REST data access for HYVE Attend risk scoring. Gathers the §26 event
// signals and persists computed scores. Server-side only (service-key reads).
import { supaGet, supaPost } from '@/lib/supabase'
import type { EventRiskInput, RiskAssessment } from '@/lib/attend/risk/risk-scoring'

interface EventRow {
  creator_id: string
  starts_at: string | null
  created_at: string
}

/**
 * Gather the observable §26 risk signals for one event. Returns null if the
 * event does not exist.
 */
export async function gatherEventRiskInput(eventId: string): Promise<EventRiskInput | null> {
  const eventRes = await supaGet(
    'attend_events',
    `id=eq.${eventId}&deleted_at=is.null&select=creator_id,starts_at,created_at`,
  )
  if (!eventRes.ok) throw new Error(`attend_events risk query failed: ${eventRes.status}`)
  const event = ((await eventRes.json()) as EventRow[])[0]
  if (!event) return null

  // The creator's events (this one excluded) — the "new organizer" signal and
  // the id set for the dispute / refund history counts.
  const creatorEvents = await idList(
    'attend_events',
    `creator_id=eq.${event.creator_id}&id=neq.${eventId}&deleted_at=is.null&select=id`,
  )

  const [maxPrice, streamTested, payoutVerified, disputeCount, refundCount] = await Promise.all([
    maxTicketPrice(eventId),
    hasPassedStreamTest(eventId),
    creatorPayoutVerified(event.creator_id),
    historyCount('attend_disputes', creatorEvents),
    historyCount('attend_refund_requests', creatorEvents),
  ])

  const listedAt = new Date(event.created_at).getTime()
  const startsAt = event.starts_at ? new Date(event.starts_at).getTime() : listedAt
  const hoursListedToStart = Math.max(0, (startsAt - listedAt) / 3_600_000)

  return {
    priorEventCount: creatorEvents.length,
    maxTicketPriceCents: maxPrice,
    streamTested,
    payoutVerified,
    priorDisputeCount: disputeCount,
    priorRefundCount: refundCount,
    hoursListedToStart,
  }
}

/** Persist a computed risk score for an event (a row in the §26 history table). */
export async function recordEventRisk(
  eventId: string,
  assessment: RiskAssessment,
): Promise<void> {
  const res = await supaPost('attend_risk_scores', {
    subject_type: 'EVENT',
    subject_id: eventId,
    score: assessment.score,
    factors: { band: assessment.band, ...assessment.factors },
  })
  if (!res.ok) {
    console.error(`[risk] failed to record score for ${eventId}: ${res.status}`)
  }
}

async function idList(table: string, query: string): Promise<string[]> {
  const res = await supaGet(table, query)
  if (!res.ok) throw new Error(`${table} query failed: ${res.status}`)
  return ((await res.json()) as { id: string }[]).map((r) => r.id)
}

async function maxTicketPrice(eventId: string): Promise<number> {
  const res = await supaGet(
    'attend_ticket_types',
    `event_id=eq.${eventId}&select=price_cents&order=price_cents.desc&limit=1`,
  )
  if (!res.ok) throw new Error(`attend_ticket_types risk query failed: ${res.status}`)
  const rows = (await res.json()) as { price_cents: number }[]
  return rows[0]?.price_cents ?? 0
}

async function hasPassedStreamTest(eventId: string): Promise<boolean> {
  const res = await supaGet(
    'attend_streams',
    `event_id=eq.${eventId}&select=test_passed_at`,
  )
  if (!res.ok) throw new Error(`attend_streams risk query failed: ${res.status}`)
  const rows = (await res.json()) as { test_passed_at: string | null }[]
  return rows[0]?.test_passed_at != null
}

async function creatorPayoutVerified(creatorId: string): Promise<boolean> {
  const res = await supaGet(
    'attend_payout_accounts',
    `profile_id=eq.${creatorId}&select=payouts_enabled`,
  )
  if (!res.ok) throw new Error(`attend_payout_accounts risk query failed: ${res.status}`)
  const rows = (await res.json()) as { payouts_enabled: boolean }[]
  return rows[0]?.payouts_enabled ?? false
}

// Count rows of `table` whose event_id is in the creator's other events.
async function historyCount(table: string, eventIds: string[]): Promise<number> {
  if (eventIds.length === 0) return 0
  const res = await supaGet(table, `event_id=in.(${eventIds.join(',')})&select=id`)
  if (!res.ok) throw new Error(`${table} risk count failed: ${res.status}`)
  return ((await res.json()) as unknown[]).length
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/attend/risk/risk-repository.ts
git commit -m "feat(attend): add risk repository (Phase 6f task 2)"
```

---

### Task 3: Risk service

Composes the gather → score → persist flow into one call.

**Files:**
- Create: `src/lib/attend/risk/risk-service.ts`

- [ ] **Step 1: Write the service**

Create `src/lib/attend/risk/risk-service.ts`:

```ts
// HYVE Attend risk — assess an event's §26 risk. `evaluateEventRisk` gathers
// the observable signals and scores them (no write — safe on a page render);
// `assessAndRecordEventRisk` also persists the score and is reserved for a
// genuine decision point (settlement).
import { scoreEvent, type RiskAssessment } from '@/lib/attend/risk/risk-scoring'
import { gatherEventRiskInput, recordEventRisk } from '@/lib/attend/risk/risk-repository'

export type { RiskAssessment }

// The assessment used when an event's signals cannot be gathered — treated as
// low risk so a data gap never blocks a reviewer or extends a hold.
const UNKNOWN: RiskAssessment = { score: 0, band: 'LOW', factors: {} }

/**
 * Evaluate one event's risk: gather its §26 signals and score them. No write,
 * so this is safe to call on every render of the admin queue. A gather failure
 * degrades to LOW rather than throwing — risk is advisory, and a missing score
 * must not break the admin queue or settlement.
 */
export async function evaluateEventRisk(eventId: string): Promise<RiskAssessment> {
  try {
    const input = await gatherEventRiskInput(eventId)
    if (!input) return UNKNOWN
    return scoreEvent(input)
  } catch (err) {
    console.error(`[risk] evaluation failed for ${eventId}:`, (err as Error).message)
    return UNKNOWN
  }
}

/**
 * Evaluate an event's risk and persist the score to attend_risk_scores. Used
 * at a genuine decision point (settlement) — one row per event, not per render.
 */
export async function assessAndRecordEventRisk(eventId: string): Promise<RiskAssessment> {
  const assessment = await evaluateEventRisk(eventId)
  try {
    await recordEventRisk(eventId, assessment)
  } catch (err) {
    console.error(`[risk] record failed for ${eventId}:`, (err as Error).message)
  }
  return assessment
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/attend/risk/risk-service.ts
git commit -m "feat(attend): add risk service (Phase 6f task 3)"
```

---

### Task 4: Risk band in the admin review queue

The admin review page assesses each event awaiting review and shows its risk band.

**Files:**
- Modify: `src/app/attend/admin/page.tsx`

- [ ] **Step 1: Rewrite the admin review page**

Replace the contents of `src/app/attend/admin/page.tsx` with:

```tsx
import { listEventsByStatus } from '@/lib/attend/events/repository'
import { evaluateEventRisk } from '@/lib/attend/risk/risk-service'
import ReviewClient from './review-client'

export const metadata = { title: 'Attend admin' }
export const dynamic = 'force-dynamic'

const fmtWhen = (iso: string | null) => (iso ? iso.slice(0, 16).replace('T', ' ') : 'Date TBA')

const riskColor: Record<string, string> = {
  LOW: 'text-green-400',
  MEDIUM: 'text-[#E8C456]',
  HIGH: 'text-red-400',
}

export default async function AdminPage() {
  const events = await listEventsByStatus('SUBMITTED_FOR_REVIEW')
  const risks = await Promise.all(events.map((ev) => evaluateEventRisk(ev.id)))

  return (
    <div>
      <h2 className="text-xs font-black tracking-[0.2em] text-[#9e8a55]">
        EVENTS AWAITING REVIEW
      </h2>
      {events.length === 0 ? (
        <p className="mt-3 text-sm text-[#9e8a55]">No events awaiting review.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {events.map((ev, i) => (
            <li
              key={ev.id}
              className="flex items-center justify-between gap-3 rounded border border-[#2a2135] bg-[#111111] px-4 py-3"
            >
              <div>
                <span className="text-sm font-bold">{ev.title}</span>
                <p className="text-xs text-[#9e8a55]">
                  {ev.show_type} · starts {fmtWhen(ev.starts_at)}
                </p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#9e8a55]">
                  Risk:{' '}
                  <span className={riskColor[risks[i].band] ?? 'text-[#9e8a55]'}>
                    {risks[i].band} ({risks[i].score})
                  </span>
                </p>
              </div>
              <ReviewClient eventId={ev.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/attend/admin/page.tsx
git commit -m "feat(attend): show event risk in the admin review queue (Phase 6f task 4)"
```

---

### Task 5: Risk-aware payout hold

Migration 032 lets `attend_settle_event` take a `hold_days` argument; the settlement job assesses each ending event's risk and holds a HIGH-risk event's payout for longer (§16).

**Files:**
- Create: `supabase/migrations/032_attend_settle_event_hold.sql`
- Modify: `src/lib/attend/payouts/settlement-service.ts`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/032_attend_settle_event_hold.sql`:

```sql
-- HYVE Attend — make the settlement hold window risk-aware (spec §16/§26).
-- attend_settle_event (migration 030) hardcoded a 7-day hold; it now takes a
-- hold_days argument so the caller can extend the hold for a high-risk event.
-- All other behaviour is unchanged from migration 030.
create or replace function attend_settle_event(p_args jsonb)
returns jsonb language plpgsql as $$
declare
  v_event_id   uuid := (p_args->>'event_id')::uuid;
  v_amount     int  := (p_args->>'amount_cents')::int;
  v_hold_days  int  := greatest(1, coalesce((p_args->>'hold_days')::int, 7));
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

  if v_amount <= 0 or v_account_id is null then
    update attend_events set status = 'SETTLED', updated_at = now()
     where id = v_event_id;
    return jsonb_build_object('event_id', v_event_id, 'settled', true, 'payout', false);
  end if;

  insert into attend_payouts
    (event_id, payout_account_id, amount_cents, status, scheduled_release_at)
  values
    (v_event_id, v_account_id, v_amount, 'HELD', now() + make_interval(days => v_hold_days))
  returning id into v_payout_id;

  update attend_events set status = 'SETTLEMENT_HOLD', updated_at = now()
   where id = v_event_id;

  return jsonb_build_object('event_id', v_event_id, 'settled', true,
    'payout', true, 'payout_id', v_payout_id);
end $$;
```

- [ ] **Step 2: Apply the migration**

Apply with the Supabase MCP `apply_migration` tool — project ref `jlyqezwuyhfevrdomazd`, name `attend_settle_event_hold`, contents = the file above.

- [ ] **Step 3: Verify the migration applied**

Run with the Supabase MCP `execute_sql` tool:

```sql
select count(*) as ok from pg_proc
 where proname = 'attend_settle_event' and prosrc like '%make_interval%';
```

Expected: one row, `ok = 1`.

- [ ] **Step 4: Make the settlement job risk-aware**

In `src/lib/attend/payouts/settlement-service.ts`, add the import and pass a risk-based `hold_days` to the RPC.

Add to the imports:

```ts
import { assessAndRecordEventRisk } from '@/lib/attend/risk/risk-service'
```

Replace the body of the `for (const event of events)` loop in `settleEndedEvents` — specifically the `supaPost('rpc/attend_settle_event', ...)` call — so it reads:

```ts
    try {
      const net = computeArtistNet(await getEventLedgerEntries(event.id))
      // A HIGH-risk event holds its payout longer (§16/§26).
      const risk = await assessAndRecordEventRisk(event.id)
      const holdDays = risk.band === 'HIGH' ? 21 : 7
      const res = await supaPost('rpc/attend_settle_event', {
        p_args: { event_id: event.id, amount_cents: net, hold_days: holdDays },
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
```

(That replaces the existing `try { ... } catch { ... }` block inside the loop — the only change is the added `assessEventRisk` call and the `hold_days` argument.)

- [ ] **Step 5: Typecheck, build, and run the test suite**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds.

Run: `npx vitest run`
Expected: all tests pass, including `risk-scoring.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/032_attend_settle_event_hold.sql src/lib/attend/payouts/settlement-service.ts
git commit -m "feat(attend): risk-aware payout hold (Phase 6f task 5)"
```

---

## Verification & acceptance

After all tasks, confirm:

- `npx tsc --noEmit`, `npx vitest run`, and `npm run build` all pass.
- Migration 032 is applied (the Task 5 probe).
- The §26 flow is reachable: an event awaiting review is scored from its observable signals → the band shows in the admin queue → at settlement a HIGH-risk event's payout is held 21 days instead of 7.
- Isolation holds: `git diff main --stat` shows only new files plus the Attend-owned `admin/page.tsx` and `settlement-service.ts`.

**Deferred to later phases (out of scope for 6f):**
- User-level risk scoring (§26 user inputs — chargeback history, failed payments, device/IP anomalies, transfer abuse, shared payment methods).
- §26 signals needing data HYVE does not collect — suspicious traffic, famous-artist/brand claims, AI likeness.
- The other §26 risk *outputs* — require stream test, limit ticket quantity, disable transfers, escalate refund/dispute. 6f wires only the payout-hold extension; the rest is left to the human reviewer who now sees the band.
