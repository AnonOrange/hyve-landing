# HYVE Attend — Phase 2c: Creator Dashboard Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. This plan is executed in-session against the `attend-phase-2c-creator-dashboard` branch.

**Goal:** Give a creator a per-event dashboard to manage ticket tiers, edit draft details, see where the event sits in the setup chain, and move a finished draft into that chain.

**Architecture:** A new server route `/attend/creator/events/[id]` loads one owned event plus its ticket types and renders a client dashboard composed of focused panels (setup progress, event details, ticket types). The one missing lifecycle edge — `DRAFT → REGISTRATION_PENDING | STREAM_SETUP_REQUIRED` — is added as a guarded `submitDraft` service method exposed through a new `start-setup` PATCH action. The flat `/attend/creator` list becomes a list of links into per-event dashboards. All additive: new files under `attend/(creator)/creator/events/`, three small edits to existing `events` lib/route files, one edit to the creator index client.

**Tech Stack:** Next.js 14 App Router, TypeScript (strict), Tailwind, Vitest. Raw-REST Supabase access via existing repositories. No new dependencies.

---

## Context for the executor

The creator-side **API and services are already complete** after Phases 2a/2b:

- `GET/POST /api/attend/events`, `GET/PATCH /api/attend/events/[id]` — event list/create/get/edit.
- `GET/POST /api/attend/events/[id]/ticket-types`, `PATCH/DELETE /api/attend/ticket-types/[id]` — full ticket-type CRUD.
- `POST /api/attend/events/[id]/pay-registration` — returns `{ url }` for Stripe Checkout.
- `POST /api/attend/connect/onboard` — returns `{ url }` for Stripe Connect onboarding.
- `events/service.ts` exposes `createDraftEvent`, `getCreatorEvent`, `listMyEvents`, `updateEventDetails`, `changeEventStatus`, `advanceSetup`, and the `ValidationError/ForbiddenError/NotFoundError` classes.
- `ticketing/ticket-type-service.ts` exposes `listEventTicketTypes`, `addTicketType`, `editTicketType`, `removeTicketType`.

**The one real gap:** nothing performs the `DRAFT → REGISTRATION_PENDING` (paid show) or `DRAFT → STREAM_SETUP_REQUIRED` (`FREE_EVENT`) transition. `advanceSetup` only covers `PROMOTION_FEE_PAID`/`PAYOUT_SETUP_REQUIRED`, and the PATCH route only exposes `advance-setup`/`cancel`. A created event is stranded in `DRAFT`. Task 1 closes this.

**Layering rule:** `ticketing` imports from `events`; `events` must NOT import `ticketing` (cycle). The "≥1 ticket type" guard is therefore enforced by passing a ticket-type *count* into the events service — the same pattern as `advanceSetup(id, creatorId, payoutsAreEnabled)`. The API route composes both modules.

**Out of scope (later phases, do not scaffold):** stream setup/test (Phase 5), submit-for-review (its guard needs a passed stream test — Phase 5), live sales / attendee list / refund-dispute / payout-estimate panels (Phases 3/6). The dashboard shows only what is real this phase — no empty placeholder panels.

## File Structure

**Modify:**
- `src/lib/attend/events/lifecycle.ts` — add pure `draftTargetStatus(showType)`.
- `src/lib/attend/events/lifecycle.test.ts` — add `draftTargetStatus` tests.
- `src/lib/attend/events/service.ts` — add `submitDraft(id, creatorId, ticketTypeCount)`.
- `src/app/api/attend/events/[id]/route.ts` — add the `start-setup` PATCH action; fix the stale PATCH doc comment.
- `src/app/attend/(creator)/creator/creator-events-client.tsx` — rows link to per-event dashboards; redirect to the new event's dashboard after creation; drop the inline per-event action buttons.

**Create (all under `src/app/attend/(creator)/creator/events/[id]/`):**
- `page.tsx` — server component: load owned event + ticket types + payouts flag.
- `event-dashboard-client.tsx` — composes the panels + the status-contextual primary action.
- `setup-progress.tsx` — presentational setup-chain stepper.
- `ticket-types-panel.tsx` — ticket-tier list + add/edit/delete (editable only while `DRAFT`).
- `event-details-panel.tsx` — edit core event fields while `DRAFT`; read-only display afterward.

---

## Task 1: The `DRAFT → setup` transition

**Files:**
- Modify: `src/lib/attend/events/lifecycle.ts`
- Modify: `src/lib/attend/events/lifecycle.test.ts`
- Modify: `src/lib/attend/events/service.ts`
- Modify: `src/app/api/attend/events/[id]/route.ts`

- [ ] **Step 1: Write the failing test** — append to `lifecycle.test.ts`:

```ts
import { draftTargetStatus } from './lifecycle'

describe('draftTargetStatus', () => {
  it('routes a free event straight to stream setup', () => {
    expect(draftTargetStatus('FREE_EVENT')).toBe('STREAM_SETUP_REQUIRED')
  })
  it('routes a paid show to the registration fee', () => {
    expect(draftTargetStatus('HUMAN_LIVE_BROADCAST')).toBe('REGISTRATION_PENDING')
    expect(draftTargetStatus('PRIVATE_EVENT')).toBe('REGISTRATION_PENDING')
  })
})
```

(Merge the `import` with the existing lifecycle import line rather than duplicating it.)

- [ ] **Step 2: Run it, expect FAIL** — `npm test` → fails: `draftTargetStatus` is not exported.

- [ ] **Step 3: Add `draftTargetStatus` to `lifecycle.ts`.** A `FREE_EVENT` skips the fee + payout gates (spec §6.9); every other MVP show type pays the $50 registration fee first. `DRAFT` legally transitions to both `REGISTRATION_PENDING` and `STREAM_SETUP_REQUIRED` (see `BASE_TRANSITIONS.DRAFT`); this picks which, by show type.

```ts
/** Which of DRAFT's two legal successors an event takes, by show type. */
export function draftTargetStatus(showType: string): EventStatus {
  return showType === 'FREE_EVENT' ? 'STREAM_SETUP_REQUIRED' : 'REGISTRATION_PENDING'
}
```

- [ ] **Step 4: Run it, expect PASS** — `npm test`.

- [ ] **Step 5: Add `submitDraft` to `service.ts`.** Import `draftTargetStatus` (extend the existing `lifecycle` import). Mirrors `advanceSetup`: the route supplies `ticketTypeCount` so `events` need not import `ticketing`.

```ts
/**
 * Move a finished DRAFT into the setup chain: a paid show to
 * REGISTRATION_PENDING, a FREE_EVENT straight to STREAM_SETUP_REQUIRED.
 * `ticketTypeCount` is supplied by the route (events must not import ticketing).
 */
export async function submitDraft(
  id: string,
  creatorId: string,
  ticketTypeCount: number,
): Promise<EventStatus> {
  const event = await loadOwned(id, creatorId)
  if (event.status !== 'DRAFT') {
    throw new ValidationError('Only a draft event can be moved into setup')
  }
  if (!event.starts_at || !event.ends_at) {
    throw new ValidationError('Set the event start and end times before continuing')
  }
  const target = draftTargetStatus(event.show_type)
  if (target === 'REGISTRATION_PENDING' && ticketTypeCount < 1) {
    throw new ValidationError('Add at least one ticket type before continuing')
  }
  assertTransition(event.status, target)
  await updateEvent(id, { status: target, updated_by: creatorId })
  return target
}
```

- [ ] **Step 6: Add the `start-setup` action to the PATCH route.** In `src/app/api/attend/events/[id]/route.ts`: import `submitDraft` (extend the `events/service` import) and `listEventTicketTypes` from `@/lib/attend/ticketing/ticket-type-service`. Add this branch **before** the `body.action === 'cancel'` branch:

```ts
    if (body.action === 'start-setup') {
      const ticketTypes = await listEventTicketTypes(params.id, profile.id)
      const status = await submitDraft(params.id, profile.id, ticketTypes.length)
      return NextResponse.json({ ok: true, status })
    }
```

Also fix the stale comment above `PATCH` — it still describes a `status` field; the route is action-based. Replace with: `// PATCH /api/attend/events/[id] — { action } triggers a guarded lifecycle step; an actionless body is a draft-details edit.`

- [ ] **Step 7: Verify** — `npx tsc --noEmit` clean; `npm test` green.

- [ ] **Step 8: Commit** — `feat(attend): add the DRAFT->setup transition (Phase 2c task 1)`.

---

## Task 2: Per-event dashboard server route

**Files:**
- Create: `src/app/attend/(creator)/creator/events/[id]/page.tsx`
- Create: `src/app/attend/(creator)/creator/events/[id]/event-dashboard-client.tsx` (skeleton this task; panels wired in Task 6)

- [ ] **Step 1: Write `page.tsx`** — server component, ownership-checked load, `notFound()` on a missing/foreign event:

```tsx
import { notFound, redirect } from 'next/navigation'
import { requireCreator } from '@/lib/attend/identity/roles'
import { getCreatorEvent, ForbiddenError, NotFoundError } from '@/lib/attend/events/service'
import { listEventTicketTypes } from '@/lib/attend/ticketing/ticket-type-service'
import { payoutsEnabled } from '@/lib/attend/payments/connect-service'
import EventDashboardClient from './event-dashboard-client'

export const metadata = { title: 'Event — HYVE Attend' }
export const dynamic = 'force-dynamic'

export default async function EventDashboardPage({ params }: { params: { id: string } }) {
  const profile = await requireCreator()
  if (!profile) redirect('/attend/login')
  try {
    const [event, ticketTypes, payouts] = await Promise.all([
      getCreatorEvent(params.id, profile.id),
      listEventTicketTypes(params.id, profile.id),
      payoutsEnabled(profile.id),
    ])
    return (
      <EventDashboardClient event={event} ticketTypes={ticketTypes} payoutsEnabled={payouts} />
    )
  } catch (err) {
    if (err instanceof NotFoundError || err instanceof ForbiddenError) notFound()
    throw err
  }
}
```

- [ ] **Step 2: Skeleton `event-dashboard-client.tsx`** — `'use client'`; typed props `{ event: EventRow; ticketTypes: TicketTypeRow[]; payoutsEnabled: boolean }` (import `EventRow` from `@/lib/attend/events/repository`, `TicketTypeRow` from `@/lib/attend/ticketing/ticket-type-repository`). For now render the event title, a status badge, show type, and a `← Back to events` link to `/attend/creator`. Panels are added in Task 6. Reuse the existing dark Tailwind palette (`#08070a`/`#111111`/`#2a2135`/`#E8C456`/`#ede8d8`/`#9e8a55`) seen in `creator-events-client.tsx`.

- [ ] **Step 3: Verify** — `npx tsc --noEmit`; `npm run build` compiles the new route.

- [ ] **Step 4: Commit** — `feat(attend): add the per-event creator dashboard route (Phase 2c task 2)`.

---

## Task 3: Setup-progress stepper

**Files:**
- Create: `src/app/attend/(creator)/creator/events/[id]/setup-progress.tsx`

- [ ] **Step 1: Build the component.** `'use client'` not required — it is presentational; keep it a plain component. Props: `{ status: EventStatus; showType: string }`.

  Define the ordered setup chain. Paid show: `DRAFT → REGISTRATION_PENDING → PROMOTION_FEE_PAID → PAYOUT_SETUP_REQUIRED → STREAM_SETUP_REQUIRED → SUBMITTED_FOR_REVIEW → PUBLISHED`. `FREE_EVENT`: `DRAFT → STREAM_SETUP_REQUIRED → SUBMITTED_FOR_REVIEW → PUBLISHED` (use `draftTargetStatus` to decide which chain). Each step has a short label (e.g. `Draft`, `Registration fee`, `Payout setup`, `Stream setup`, `Review`, `Published`).

  Render the steps as a horizontal stepper. Classify each step against the event's current status by its index in the chain: past = done (filled `#E8C456`), current = highlighted, future = muted (`#9e8a55`). Statuses outside the chain (`ON_SALE`+, `CANCELLED`, etc.) → render every chain step as done and show the live status separately. Keep it simple — no animation.

- [ ] **Step 2: Verify** — `npx tsc --noEmit`.

- [ ] **Step 3: Commit** — `feat(attend): add the setup-progress stepper (Phase 2c task 3)`.

---

## Task 4: Ticket-types panel

**Files:**
- Create: `src/app/attend/(creator)/creator/events/[id]/ticket-types-panel.tsx`

- [ ] **Step 1: Read `src/lib/attend/money.ts`** to use its dollars↔cents helpers for price display/entry. Do not hand-roll cent math.

- [ ] **Step 2: Build the panel.** `'use client'`. Props: `{ eventId: string; ticketTypes: TicketTypeRow[]; editable: boolean }` (`editable` is `status === 'DRAFT'`).

  - Render each existing tier: name, kind, price (formatted USD), `quantity_total`, `max_per_order`.
  - When `editable`: an **add** form (name; kind `<select>` over the 8 kinds from `ticket-type-service.ts`'s `KINDS`; price in dollars; quantity; max per order) and per-row **edit**/**delete** controls. Convert the dollar price to integer cents before sending.
  - When not `editable`: list only, with a muted "Ticket types are locked once setup begins" note.
  - API calls: add → `POST /api/attend/events/${eventId}/ticket-types`; edit → `PATCH /api/attend/ticket-types/${id}`; delete → `DELETE /api/attend/ticket-types/${id}`. Bodies match `TicketTypeInput` (`{ name, kind, priceCents, quantityTotal, maxPerOrder }`).
  - On success, `window.location.reload()` (consistent with `creator-events-client.tsx`). Surface `{ error }` from non-OK responses inline. Use a `busy` state to disable controls during a request.

- [ ] **Step 3: Verify** — `npx tsc --noEmit`.

- [ ] **Step 4: Commit** — `feat(attend): add the ticket-types management panel (Phase 2c task 4)`.

---

## Task 5: Event-details panel

**Files:**
- Create: `src/app/attend/(creator)/creator/events/[id]/event-details-panel.tsx`

- [ ] **Step 1: Build the panel.** `'use client'`. Props: `{ event: EventRow; editable: boolean }`.

  - When `editable` (`status === 'DRAFT'`): a form over `title`, `description`, `starts_at`, `ends_at`, `timezone`, `policy_text`, `refund_cutoff_hours`, `transfer_cutoff_hours`. `starts_at`/`ends_at` use `datetime-local` inputs — convert to ISO strings on submit and back to the `datetime-local` value format for the initial value. Submit a single `PATCH /api/attend/events/${event.id}` with **no `action`** (an actionless body is a details edit — `updateEventDetails`). Send only the editable fields.
  - **`visibility` is intentionally NOT exposed** even though it is in the service's `EDITABLE_FIELDS`. In the MVP it is derived from show type at creation (`PRIVATE_EVENT → PRIVATE`, else `PUBLIC`); a standalone visibility toggle would decouple it from show type with no MVP use case. Leave it out of the form.
  - When not `editable`: read-only display of the same fields with a muted "Details are locked once setup begins" note.
  - On success, `window.location.reload()`; show `{ error }` inline; `busy` state disables the form mid-request.

- [ ] **Step 2: Verify** — `npx tsc --noEmit`.

- [ ] **Step 3: Commit** — `feat(attend): add the event-details panel (Phase 2c task 5)`.

---

## Task 6: Assemble the dashboard + restructure the creator index

**Files:**
- Modify: `src/app/attend/(creator)/creator/events/[id]/event-dashboard-client.tsx`
- Modify: `src/app/attend/(creator)/creator/creator-events-client.tsx`

- [ ] **Step 1: Compose the dashboard.** In `event-dashboard-client.tsx` render, in order: the header (title, status badge, show type, `← Back to events`); `<SetupProgress>`; the **status-contextual primary action**; `<EventDetailsPanel>`; `<TicketTypesPanel>`. The contextual action:
  - `DRAFT` → **"Start setup"** button → `PATCH { action: 'start-setup' }`; on success reload. (The server enforces ≥1 ticket type for paid shows; also surface that error inline.)
  - `REGISTRATION_PENDING` → **"Pay $50 registration"** → `POST /api/attend/events/${id}/pay-registration`, redirect to the returned `{ url }`.
  - `PROMOTION_FEE_PAID` → **"Advance setup"** → `PATCH { action: 'advance-setup' }`; reload.
  - `PAYOUT_SETUP_REQUIRED` → if `!payoutsEnabled`, **"Connect payouts"** → `POST /api/attend/connect/onboard`, redirect to `{ url }`; if `payoutsEnabled`, **"Advance setup"** → `PATCH { action: 'advance-setup' }`.
  - `STREAM_SETUP_REQUIRED` → a disabled **"Stream setup — coming soon"** note (Phase 5).
  - Any other status → no primary action, status only.
  Pass `editable={event.status === 'DRAFT'}` to both panels.

- [ ] **Step 2: Restructure `creator-events-client.tsx`.**
  - Each event `<li>` becomes a link to `/attend/creator/events/${ev.id}` (keep title + status badge; drop the inline `Pay $50 registration` and `Advance setup` buttons and the now-unused `advanceSetup` function).
  - Keep the header **Connect payouts** button and its `redirectVia` helper, the create form, and the `error` display.
  - In `createEvent`: on a successful `POST /api/attend/events`, read the created event from the response (`const created = await res.json()`) and `window.location.href = `/attend/creator/events/${created.id}`` instead of reloading — drop the new creator straight into the dashboard.

- [ ] **Step 3: Verify** — `npx tsc --noEmit`; `npm test` green; `npm run build` succeeds with no regression to existing routes.

- [ ] **Step 4: Commit** — `feat(attend): assemble the creator dashboard + link the event list (Phase 2c task 6)`.

---

## Verification checklist (whole phase)

- [ ] `npx tsc --noEmit` — clean.
- [ ] `npm test` — all suites green, including the new `draftTargetStatus` tests.
- [ ] `npm run build` — succeeds; the new `/attend/creator/events/[id]` route is listed; no existing route changed.
- [ ] Manual reasoning trace: create event → lands on dashboard → add a ticket type → "Start setup" → `REGISTRATION_PENDING` → "Pay $50 registration" reachable. `FREE_EVENT` → "Start setup" → `STREAM_SETUP_REQUIRED`.
- [ ] No new dependencies; no edit outside the files listed above; the only shared-file touch is none (all Attend-namespaced).

## Notes

- **DRY/YAGNI:** no placeholder sales/attendee/payout panels — those arrive with their data in Phases 3/6.
- The dashboard reuses the established dark palette and the `window.location.reload()` mutation-then-reload pattern already used across the creator UI; no client data-fetching layer is introduced.
