# HYVE Attend — Phase 6a: Admin Area + Event Review Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax. Executed in-session against the `attend-phase-6a-admin-review` branch. First slice of Phase 6 (back office); 6b is refunds, 6c is disputes/payouts/jobs/risk.

**Goal:** An Attend admin/reviewer can review events submitted for review and approve (→ `PUBLISHED`) or reject (→ `DRAFT`) them; a creator can then put an approved event on sale — completing the create → publish → on-sale chain.

**Architecture:** A new `/attend/admin` area, gated server-side by an `ADMIN`/`REVIEWER` role check (Attend's own roles — independent of the umbrella `/admin`). Approve/reject are guarded `attend_events` status changes with no creator-ownership check; every decision writes an `attend_audit_logs` row. `PUBLISHED → ON_SALE` is a new creator action.

**Tech Stack:** Next.js 14, TypeScript (strict), Tailwind, Vitest. No migration, no new dependency.

---

## Context for the executor

Phases 1–5c are merged. An event reaches `SUBMITTED_FOR_REVIEW` (Phase 5a's `submitForReview`). **Nothing reviews it** — it is stuck there; no event can reach `PUBLISHED`/`ON_SALE`, so the buyer flow is currently unreachable end-to-end.

**Schema (already migrated):**
- `attend_profiles.role` — `attend_role` enum `USER/CREATOR/MODERATOR/ADMIN/REVIEWER`.
- `attend_audit_logs` — `id, actor_id (uuid), actor_type ('HUMAN'/'SYSTEM'), action, entity_type, entity_id (uuid), metadata (jsonb), ip_hash, user_agent, created_at`.
- `attend_events.status` — `SUBMITTED_FOR_REVIEW → PUBLISHED` and `SUBMITTED_FOR_REVIEW → DRAFT` and `PUBLISHED → ON_SALE` are all legal in `lifecycle.ts`.

**Spec basis** — §6 (submit & review), §6.9 (`SUBMITTED_FOR_REVIEW → PUBLISHED`/`DRAFT`, `PUBLISHED → ON_SALE`), §10 (the back office is gated by `ADMIN`/`REVIEWER`, independent of the umbrella `/admin`; sensitive actions write `attend_audit_logs`).

**Existing pieces to reuse:**
- `identity/roles.ts` — `requireCreator` (promotes `USER→CREATOR`) and `requireAttendUser`; `CreatorProfile` is the `{ id, email, role }` shape. `requireReviewer` is added here, modelled on `requireCreator` but **without** the role promotion (reviewers are appointed, not self-serve).
- `events/service.ts` — `loadOwned` (private), `changeEventStatus(id, creatorId, to)` (ownership-checked, guarded), `getEventById`, `updateEvent`, `assertTransition`, error classes. `advanceSetup`/`markEventLive` are the templates for the new no-ownership review methods.
- `events/[id]/route.ts` — the action-based PATCH.
- `event-dashboard-client.tsx` — `nextStep()` gains the `PUBLISHED` case.

**Decisions baked into this plan:**
- **Manual review for the MVP.** Every `SUBMITTED_FOR_REVIEW` event waits for an admin/reviewer; risk-based auto-approve (spec §6.9 "risk score below threshold") is deferred to Phase 6c with the risk module.
- **Audit is log-and-continue.** A failed `attend_audit_logs` write is logged, not fatal — failing a legitimate approve because the audit insert hiccuped is worse. (§10's intent — sensitive actions are audited — is met on the happy path.)
- **`PUBLISHED → ON_SALE` is a creator action** (`open-sales`). For the MVP this stands in for §6.9's "now ≥ earliest `sales_start_at`" — the creator decides when sales open. The admin approve stops at `PUBLISHED`.
- The admin area lives at `src/app/attend/admin/` (no route group) — its own `layout.tsx` gate, independent of the umbrella `/admin`.

## File Structure

**Create:**
- `src/lib/attend/audit/audit-log.ts` — `writeAuditLog`.
- `src/app/attend/admin/layout.tsx` — the `ADMIN`/`REVIEWER` gate.
- `src/app/attend/admin/page.tsx` — the event-review queue.
- `src/app/attend/admin/review-client.tsx` — the approve/reject controls.
- `src/app/api/attend/admin/events/[id]/review/route.ts` — `POST` the decision.

**Modify:**
- `src/lib/attend/identity/roles.ts` — add `requireReviewer`.
- `src/lib/attend/events/repository.ts` — add `listEventsByStatus`.
- `src/lib/attend/events/service.ts` — add `reviewApprove`, `reviewReject`.
- `src/app/api/attend/events/[id]/route.ts` — add the `open-sales` action.
- `src/app/attend/(creator)/creator/events/[id]/event-dashboard-client.tsx` — the `PUBLISHED` next step.

---

## Task 1: Foundation — reviewer role, status query, audit log

**Files:**
- Modify: `src/lib/attend/identity/roles.ts`, `src/lib/attend/events/repository.ts`
- Create: `src/lib/attend/audit/audit-log.ts`

- [ ] **Step 1: `requireReviewer` in `roles.ts`** — modelled on `requireCreator` but it does **not** promote; returns the profile only if the role is `ADMIN` or `REVIEWER`, else `null`:

```ts
/** The current user's profile if they are an ADMIN or REVIEWER, else null.
 *  Unlike requireCreator this never promotes — reviewer access is appointed. */
export async function requireReviewer(): Promise<CreatorProfile | null> {
  const user = await getAttendUser()
  if (!user) return null
  await ensureProfile(user)
  const res = await supaGet('attend_profiles', `id=eq.${user.id}&select=id,email,role`)
  if (!res.ok) throw new Error(`attend_profiles lookup failed: ${res.status}`)
  const rows = (await res.json()) as CreatorProfile[]
  const profile = rows[0]
  if (!profile || (profile.role !== 'ADMIN' && profile.role !== 'REVIEWER')) return null
  return profile
}
```

- [ ] **Step 2: `listEventsByStatus` in `events/repository.ts`** — `listEventsByStatus(status: EventStatus): Promise<EventRow[]>` → `attend_events?status=eq.${status}&deleted_at=is.null&select=*&order=updated_at.asc` (oldest-submitted first — a FIFO review queue).

- [ ] **Step 3: `audit/audit-log.ts`** — `writeAuditLog`:

```ts
import { supaPost } from '@/lib/supabase'

export interface AuditEntry {
  actorId: string | null
  action: string
  entityType: string
  entityId: string | null
  metadata?: Record<string, unknown>
}

/** Append an attend_audit_logs row for a sensitive action. A failed write is
 *  logged, not thrown — auditing must not fail the action it records. */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  const res = await supaPost(
    'attend_audit_logs',
    {
      actor_id: entry.actorId,
      actor_type: 'HUMAN',
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      metadata: entry.metadata ?? {},
    },
    'return=minimal',
  )
  if (!res.ok) console.error(`[attend audit] write failed: ${res.status}`)
}
```

- [ ] **Step 4: Verify** — `npx tsc --noEmit`; `npm test` green.
- [ ] **Step 5: Commit** — `feat(attend): add the reviewer role, status query, and audit log (Phase 6a task 1)`.

---

## Task 2: Event review transitions

**Files:**
- Modify: `src/lib/attend/events/service.ts`, `src/app/api/attend/events/[id]/route.ts`

- [ ] **Step 1: `reviewApprove` / `reviewReject` in `events/service.ts`** — admin-driven, no ownership check (the route enforces the reviewer role):

```ts
/** Reviewer approves a submitted event: SUBMITTED_FOR_REVIEW -> PUBLISHED. */
export async function reviewApprove(eventId: string, reviewerId: string): Promise<void> {
  const event = await getEventById(eventId)
  if (!event) throw new NotFoundError('Event not found')
  if (event.status !== 'SUBMITTED_FOR_REVIEW') {
    throw new ValidationError('This event is not awaiting review')
  }
  assertTransition(event.status, 'PUBLISHED')
  await updateEvent(eventId, { status: 'PUBLISHED', updated_by: reviewerId })
}

/** Reviewer rejects a submitted event back to the creator: -> DRAFT. */
export async function reviewReject(eventId: string, reviewerId: string): Promise<void> {
  const event = await getEventById(eventId)
  if (!event) throw new NotFoundError('Event not found')
  if (event.status !== 'SUBMITTED_FOR_REVIEW') {
    throw new ValidationError('This event is not awaiting review')
  }
  assertTransition(event.status, 'DRAFT')
  await updateEvent(eventId, { status: 'DRAFT', updated_by: reviewerId })
}
```

- [ ] **Step 2: `open-sales` action** in `events/[id]/route.ts` PATCH — a creator action, before `cancel`:

```ts
    if (body.action === 'open-sales') {
      await changeEventStatus(params.id, profile.id, 'ON_SALE')
      return NextResponse.json({ ok: true, status: 'ON_SALE' })
    }
```

`changeEventStatus` already asserts ownership + the `PUBLISHED → ON_SALE` transition.

- [ ] **Step 3: Verify** — `npx tsc --noEmit`; `npm test` green.
- [ ] **Step 4: Commit** — `feat(attend): add event review transitions + open-sales (Phase 6a task 2)`.

---

## Task 3: The admin event-review queue

**Files:**
- Create: `src/app/attend/admin/layout.tsx`, `page.tsx`, `review-client.tsx`

- [ ] **Step 1: `admin/layout.tsx`** — the gate. `export const dynamic = 'force-dynamic'`. `requireReviewer()`; if null → `redirect('/attend')` (a non-reviewer is bounced; do not reveal the area). Render a thin admin chrome (a heading "Attend admin") + `{children}`.

- [ ] **Step 2: `admin/page.tsx`** — server component. `listEventsByStatus('SUBMITTED_FOR_REVIEW')`. Render a queue: each event's title, show type, creator id, wall-clock start, and an `<ReviewClient eventId>`; empty state "No events awaiting review."

- [ ] **Step 3: `review-client.tsx`** — `'use client'`. Props `{ eventId }`. Approve / Reject buttons → `POST /api/attend/admin/events/${eventId}/review` with `{ decision }`; on success `window.location.reload()`; inline error; `busy` disables. Reuse the dark palette.

- [ ] **Step 4: Verify** — `npx tsc --noEmit`; `npm run build` lists `/attend/admin`.
- [ ] **Step 5: Commit** — `feat(attend): add the admin event-review queue (Phase 6a task 3)`.

---

## Task 4: The review API route

**Files:**
- Create: `src/app/api/attend/admin/events/[id]/review/route.ts`

- [ ] **Step 1: Build the route.** `runtime = 'nodejs'`. `POST`:
  1. `requireReviewer()` — if null, `403 { error: 'Not authorized' }`.
  2. Parse `{ decision }`; must be `'approve'` or `'reject'` (else `400`).
  3. `decision === 'approve'` → `reviewApprove(params.id, profile.id)`; else `reviewReject(...)`.
  4. `writeAuditLog({ actorId: profile.id, action: `event.${decision}`, entityType: 'EVENT', entityId: params.id })`.
  5. `200 { ok: true }`. Map `ValidationError → 400`, `NotFoundError → 404`, else log + `500`.

- [ ] **Step 2: Verify** — `npx tsc --noEmit`; `npm run build` lists the route.
- [ ] **Step 3: Commit** — `feat(attend): add the event-review API route (Phase 6a task 4)`.

---

## Task 5: The creator open-sales control

**Files:**
- Modify: `src/app/attend/(creator)/creator/events/[id]/event-dashboard-client.tsx`

- [ ] **Step 1: Add the `PUBLISHED` case to `nextStep()`** — between the show-day cases and `default`:

```tsx
      case 'PUBLISHED':
        return wrap(
          'Approved — ready to sell',
          'Your event has been approved. Put tickets on sale when you are ready.',
          <button onClick={() => patchAction('open-sales')} disabled={busy} className={actionBtn}>
            {busy ? 'Working…' : 'Put tickets on sale'}
          </button>,
        )
```

Also add a `SUBMITTED_FOR_REVIEW` case — a status-only `wrap` ("Submitted for review", "An Attend reviewer is checking your event — you will be able to put it on sale once it is approved.", a disabled button) so the creator sees where it stands. (Currently `SUBMITTED_FOR_REVIEW` falls to `default` → no card.)

- [ ] **Step 2: Verify** — `npx tsc --noEmit`; `npm test` green; `npm run build` succeeds; no existing route changed.
- [ ] **Step 3: Commit** — `feat(attend): add the creator open-sales control (Phase 6a task 5)`.

---

## Verification checklist (whole phase)

- [ ] `npx tsc --noEmit` clean; `npm test` green; `npm run build` succeeds and lists `/attend/admin` + the review route.
- [ ] No migration, no new dependency, no shared-file edits.
- [ ] `/attend/admin` is gated server-side by the `ADMIN`/`REVIEWER` role; a non-reviewer is redirected.
- [ ] `reviewApprove`/`reviewReject` act only on a `SUBMITTED_FOR_REVIEW` event; each decision writes an audit row.
- [ ] The full chain is now reachable: creator submits → reviewer approves → `PUBLISHED` → creator opens sales → `ON_SALE` → discovery + checkout work.

## Notes & deferrals

- **Risk scoring + auto-approve** → Phase 6c. For the MVP every submitted event is reviewed by hand.
- **A reviewer is appointed by setting `attend_profiles.role` to `ADMIN` or `REVIEWER`** directly (e.g. via Supabase) — there is no self-serve reviewer signup, by design.
- **6b** adds refund requests, evidence packets, the recommendation rules, and the admin refund queue; **6c** adds disputes, payouts, settlement, the §4.6 jobs, and risk.
