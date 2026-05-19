# HYVE Attend — Phase 2a: Creator Core — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A creator can sign up and log into HYVE Attend with its own Supabase Auth, then create and edit draft events with ticket types — with every event-status change governed by a tested lifecycle state machine.

**Architecture:** Builds on Phase 1 (the `attend_*` schema, `getAttendUser`/`ensureProfile` in `src/lib/attend/identity/auth.ts`, the fee calculator). HYVE Attend authenticates with its own Supabase Auth, independent of Spy/CaseLine (the spec's §10 model, confirmed by the user). Auth uses `@supabase/ssr`: a browser client for sign-in/up, Phase 1's server helper for reads. Event-status changes flow through one guarded `transition` in the `events` lifecycle module. Data access uses the repo's raw-REST Supabase wrapper (`src/lib/supabase.ts`); UI follows the repo convention — a Server Component `page.tsx` (which may call services directly for its initial data load) + a co-located `_client.tsx` doing `fetch` to route handlers for mutations (the repo uses **no** Server Actions).

**Tech Stack:** Next.js 14 App Router · TypeScript · Supabase (`@supabase/ssr`, raw-REST) · Vitest.

**Source spec:** `docs/superpowers/specs/2026-05-18-hyve-attend-mvp-design.md` — this implements build-order Phase 2 (§11.2), the creator-core slice. The §6.9 event transition table and §6 creator flow are the authoritative references.

**Scope — in this plan:** Attend auth (signup/login/signout), the event lifecycle state machine, event CRUD, ticket-type CRUD, and a minimal creator events page to exercise them.
**Scope — deferred to plans 2b/2c:** the $50 registration charge + Stripe (`attend_pay_registration`), Stripe Connect Express onboarding, the full creator dashboard.

**Branch:** `attend-phase-2-creator` (already created off `main`).

---

## Conventions for this plan

- **Imports:** the `@/` alias → `./src`.
- **Route handlers:** `export const runtime = 'nodejs'`; return `NextResponse.json(...)`; on auth failure return `401`; validate input and return `400` on bad input.
- **Auth in handlers:** call `getAttendUser()` (Phase 1, `@/lib/attend/identity/auth`); if `null`, return `401`.
- **Data access:** `supaGet/supaPost/supaPatch` from `@/lib/supabase`; these return raw `Response` — always check `res.ok` and `await res.json()`.
- **Tests:** Vitest; pure logic is unit-tested. Run a single file with `npx vitest run <path>`.
- **Commits:** conventional-commit, `feat(attend): ...`, one per task.

## File Structure

| File | Responsibility |
|------|----------------|
| `src/lib/attend/identity/supabase-browser.ts` | `@supabase/ssr` browser client for client-side auth calls |
| `src/lib/attend/identity/roles.ts` | `requireCreator()` — load the profile, ensure `CREATOR` role |
| `src/app/attend/(auth)/login/page.tsx` + `login-form.tsx` | Login page (Server Component shell + client form) |
| `src/app/attend/(auth)/signup/page.tsx` + `signup-form.tsx` | Signup page (shell + client form) |
| `src/app/api/attend/auth/sync/route.ts` | Post-login: ensure the `attend_profiles` row exists |
| `src/app/api/attend/auth/signout/route.ts` | Clear the Supabase session |
| `src/lib/attend/events/lifecycle.ts` | The event-status transition topology + `canTransition`/`assertTransition` |
| `src/lib/attend/events/lifecycle.test.ts` | Unit tests for the transition table |
| `src/lib/attend/events/slug.ts` | Event slug generation |
| `src/lib/attend/events/slug.test.ts` | Unit tests for slug generation |
| `src/lib/attend/events/repository.ts` | Raw-REST queries for `attend_events` |
| `src/lib/attend/events/service.ts` | Event create/update/get/list — business logic |
| `src/lib/attend/ticketing/ticket-type-repository.ts` | Raw-REST queries for `attend_ticket_types` |
| `src/lib/attend/ticketing/ticket-type-service.ts` | Ticket-type create/update/list logic |
| `src/app/api/attend/events/route.ts` | `POST` create event, `GET` list my events |
| `src/app/api/attend/events/[id]/route.ts` | `GET` one event, `PATCH` update |
| `src/app/api/attend/events/[id]/ticket-types/route.ts` | `POST` create, `GET` list ticket types |
| `src/app/api/attend/ticket-types/[id]/route.ts` | `PATCH`, `DELETE` a ticket type |
| `src/app/attend/(creator)/creator/page.tsx` + `creator-events-client.tsx` | Minimal creator page: list events + create-event form |

---

## Chunk 1: Attend authentication

### Task 1: Supabase browser client + creator-role helper

**Files:**
- Create: `src/lib/attend/identity/supabase-browser.ts`
- Create: `src/lib/attend/identity/roles.ts`

- [ ] **Step 1: Write the browser client helper**

Create `src/lib/attend/identity/supabase-browser.ts`:

```ts
// Browser-side Supabase client for HYVE Attend auth (sign-in / sign-up).
// @supabase/ssr keeps the session in cookies the Phase 1 server helper reads.
'use client'

import { createBrowserClient } from '@supabase/ssr'

export function attendBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
```

- [ ] **Step 2: Confirm the public env vars exist**

The browser client needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The repo already has `SUPABASE_URL` and `SUPABASE_ANON_KEY` (server-only). Add the two `NEXT_PUBLIC_`-prefixed copies to `.env.local` (and `.env.example`) with the same values. This is a config addition, not code — note it in the task report so the human can set them.

- [ ] **Step 3: Write the creator-role helper**

Create `src/lib/attend/identity/roles.ts`:

```ts
// Server-side: resolve the current Attend user to a profile and ensure the
// CREATOR role. Used by every creator-only route handler and page.
import { getAttendUser, ensureProfile } from '@/lib/attend/identity/auth'
import { supaGet, supaPatch } from '@/lib/supabase'

export interface CreatorProfile {
  id: string
  email: string
  role: string
}

/**
 * Returns the current user's profile with the CREATOR role guaranteed.
 * Promotes a USER to CREATOR on first creator action (self-serve creators).
 * Returns null if not authenticated.
 */
export async function requireCreator(): Promise<CreatorProfile | null> {
  const user = await getAttendUser()
  if (!user) return null
  await ensureProfile(user)

  const res = await supaGet('attend_profiles', `id=eq.${user.id}&select=id,email,role`)
  const rows = (await res.json()) as CreatorProfile[]
  if (rows.length === 0) return null
  const profile = rows[0]

  if (profile.role === 'USER') {
    await supaPatch('attend_profiles', `id=eq.${user.id}`, { role: 'CREATOR' })
    profile.role = 'CREATOR'
  }
  return profile
}
```

- [ ] **Step 4: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors in the two new files.

- [ ] **Step 5: Commit**

```bash
git add src/lib/attend/identity/supabase-browser.ts src/lib/attend/identity/roles.ts
git commit -m "feat(attend): add Supabase browser client and creator-role helper"
```

### Task 2: Signup page

**Files:**
- Create: `src/app/attend/(auth)/signup/page.tsx`
- Create: `src/app/attend/(auth)/signup/signup-form.tsx`

- [ ] **Step 1: Write the page shell (Server Component)**

Create `src/app/attend/(auth)/signup/page.tsx`:

```tsx
import SignupForm from './signup-form'

export const metadata = { title: 'Sign up — HYVE Attend' }

export default function SignupPage() {
  return (
    <section className="mx-auto max-w-sm py-16">
      <h1 className="text-2xl font-black">Create your HYVE Attend account</h1>
      <p className="mt-2 text-sm text-[#9e8a55]">
        One account to discover shows, hold tickets, and host live events.
      </p>
      <SignupForm />
    </section>
  )
}
```

- [ ] **Step 2: Write the client form**

Create `src/app/attend/(auth)/signup/signup-form.tsx` — a `'use client'` component with `email`/`password` state. On submit: call `attendBrowserClient().auth.signUp({ email, password })`; on success `POST /api/attend/auth/sync` then `window.location.href = '/attend/creator'`; on error show the message. Use the repo's existing form styling (gold/black; `text-[#E8C456]` accents, dark inputs). Keep the component focused — only signup.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build succeeds; `/attend/signup` present in the route list.

- [ ] **Step 4: Commit**

```bash
git add "src/app/attend/(auth)/signup"
git commit -m "feat(attend): add signup page"
```

### Task 3: Login page + auth route handlers

**Files:**
- Create: `src/app/attend/(auth)/login/page.tsx`, `login-form.tsx`
- Create: `src/app/api/attend/auth/sync/route.ts`
- Create: `src/app/api/attend/auth/signout/route.ts`

- [ ] **Step 1: Write the `sync` route handler**

Create `src/app/api/attend/auth/sync/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { getAttendUser, ensureProfile } from '@/lib/attend/identity/auth'

export const runtime = 'nodejs'

// Called by the client right after sign-in / sign-up so the attend_profiles
// row exists before the user reaches a creator page.
export async function POST() {
  const user = await getAttendUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  await ensureProfile(user)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Write the `signout` route handler**

Create `src/app/api/attend/auth/signout/route.ts` — a `POST` that builds a `createServerClient` (same cookie wiring as `getAttendUser`, but with a working `setAll` that writes to a `NextResponse`) and calls `supabase.auth.signOut()`, returning the response so the cleared cookies are sent. Reference `getAttendUser` in `@/lib/attend/identity/auth` for the cookie-adapter shape. The handler must return the exact `NextResponse` instance that `setAll` wrote cookies onto — not a separate `NextResponse.json(...)` — so the browser actually receives the cleared session cookie.

- [ ] **Step 3: Write the login page shell + client form**

Create `src/app/attend/(auth)/login/page.tsx` (shell, mirrors the signup page) and `login-form.tsx` (`'use client'`): on submit call `attendBrowserClient().auth.signInWithPassword({ email, password })`; on success `POST /api/attend/auth/sync` then redirect to `/attend/creator`; on error show the message.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: build succeeds; `/attend/login` present.

- [ ] **Step 5: Commit**

```bash
git add "src/app/attend/(auth)/login" src/app/api/attend/auth
git commit -m "feat(attend): add login page and auth sync/signout routes"
```

---

## Chunk 2: Event lifecycle state machine

### Task 4: The lifecycle transition table (test-driven)

The authoritative event-status transition topology from spec §6.9. Pure module — no DB. Guards (e.g. "$50 paid") are checked by the `events` service; this module owns which `from → to` pairs are legal.

**Files:**
- Create: `src/lib/attend/events/lifecycle.ts`
- Test: `src/lib/attend/events/lifecycle.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/attend/events/lifecycle.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { canTransition, assertTransition, ALL_STATUSES } from '@/lib/attend/events/lifecycle'

describe('canTransition', () => {
  it('allows the documented paid-show setup chain', () => {
    expect(canTransition('DRAFT', 'REGISTRATION_PENDING')).toBe(true)
    expect(canTransition('REGISTRATION_PENDING', 'PROMOTION_FEE_PAID')).toBe(true)
    expect(canTransition('PROMOTION_FEE_PAID', 'PAYOUT_SETUP_REQUIRED')).toBe(true)
    expect(canTransition('PAYOUT_SETUP_REQUIRED', 'STREAM_SETUP_REQUIRED')).toBe(true)
    expect(canTransition('STREAM_SETUP_REQUIRED', 'SUBMITTED_FOR_REVIEW')).toBe(true)
  })

  it('allows a free show to skip fee + payout setup', () => {
    expect(canTransition('DRAFT', 'STREAM_SETUP_REQUIRED')).toBe(true)
  })

  it('allows the show-day path and settlement', () => {
    expect(canTransition('PUBLISHED', 'ON_SALE')).toBe(true)
    expect(canTransition('ON_SALE', 'SOUNDCHECK')).toBe(true)
    expect(canTransition('SALES_PAUSED', 'SOUNDCHECK')).toBe(true)
    expect(canTransition('SOUNDCHECK', 'DOORS_OPEN')).toBe(true)
    expect(canTransition('DOORS_OPEN', 'LIVE')).toBe(true)
    expect(canTransition('LIVE', 'ENDED')).toBe(true)
    expect(canTransition('ENDED', 'SETTLEMENT_HOLD')).toBe(true)
    expect(canTransition('SETTLEMENT_HOLD', 'SETTLED')).toBe(true)
  })

  it('allows review rejection back to DRAFT and sales pause/resume', () => {
    expect(canTransition('SUBMITTED_FOR_REVIEW', 'DRAFT')).toBe(true)
    expect(canTransition('ON_SALE', 'SALES_PAUSED')).toBe(true)
    expect(canTransition('SALES_PAUSED', 'ON_SALE')).toBe(true)
  })

  it('allows cancellation from every pre-LIVE state and from LIVE', () => {
    for (const s of ['DRAFT','REGISTRATION_PENDING','PROMOTION_FEE_PAID','PAYOUT_SETUP_REQUIRED',
                      'STREAM_SETUP_REQUIRED','SUBMITTED_FOR_REVIEW','PUBLISHED','ON_SALE',
                      'SALES_PAUSED','SOUNDCHECK','DOORS_OPEN','LIVE'] as const) {
      expect(canTransition(s, 'CANCELLED')).toBe(true)
    }
  })

  it('routes cancellation through refunding or straight to archived', () => {
    expect(canTransition('CANCELLED', 'REFUNDING')).toBe(true)
    expect(canTransition('CANCELLED', 'ARCHIVED')).toBe(true)
    expect(canTransition('REFUNDING', 'SETTLED')).toBe(true)
    expect(canTransition('SETTLED', 'ARCHIVED')).toBe(true)
  })

  it('rejects illegal transitions', () => {
    expect(canTransition('DRAFT', 'LIVE')).toBe(false)
    expect(canTransition('ENDED', 'ON_SALE')).toBe(false)
    expect(canTransition('ARCHIVED', 'DRAFT')).toBe(false)
    expect(canTransition('PUBLISHED', 'SOUNDCHECK')).toBe(false)
  })
})

describe('assertTransition', () => {
  it('throws on an illegal transition', () => {
    expect(() => assertTransition('DRAFT', 'LIVE')).toThrow()
  })
  it('does not throw on a legal transition', () => {
    expect(() => assertTransition('DRAFT', 'REGISTRATION_PENDING')).not.toThrow()
  })
})

describe('ALL_STATUSES', () => {
  it('lists the 18 event statuses', () => {
    expect(ALL_STATUSES).toHaveLength(18)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/attend/events/lifecycle.test.ts`
Expected: FAIL — cannot resolve `@/lib/attend/events/lifecycle`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/attend/events/lifecycle.ts`:

```ts
// HYVE Attend event lifecycle — the authoritative transition topology
// (spec §6.9). Pure: this module knows which from->to pairs are legal.
// Guard conditions (e.g. "$50 paid") are checked by the events service
// before it calls a transition; this module owns the topology only.

export type EventStatus =
  | 'DRAFT' | 'REGISTRATION_PENDING' | 'PROMOTION_FEE_PAID' | 'PAYOUT_SETUP_REQUIRED'
  | 'STREAM_SETUP_REQUIRED' | 'SUBMITTED_FOR_REVIEW' | 'PUBLISHED' | 'ON_SALE'
  | 'SALES_PAUSED' | 'SOUNDCHECK' | 'DOORS_OPEN' | 'LIVE' | 'ENDED'
  | 'SETTLEMENT_HOLD' | 'SETTLED' | 'REFUNDING' | 'CANCELLED' | 'ARCHIVED'

const CANCELLABLE: EventStatus[] = [
  'DRAFT', 'REGISTRATION_PENDING', 'PROMOTION_FEE_PAID', 'PAYOUT_SETUP_REQUIRED',
  'STREAM_SETUP_REQUIRED', 'SUBMITTED_FOR_REVIEW', 'PUBLISHED', 'ON_SALE',
  'SALES_PAUSED', 'SOUNDCHECK', 'DOORS_OPEN', 'LIVE',
]

// Allowed next-states per spec §6.9. CANCELLED is appended to every
// cancellable state's list below.
const BASE_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  DRAFT: ['REGISTRATION_PENDING', 'STREAM_SETUP_REQUIRED'],
  REGISTRATION_PENDING: ['PROMOTION_FEE_PAID'],
  PROMOTION_FEE_PAID: ['PAYOUT_SETUP_REQUIRED'],
  PAYOUT_SETUP_REQUIRED: ['STREAM_SETUP_REQUIRED'],
  STREAM_SETUP_REQUIRED: ['SUBMITTED_FOR_REVIEW'],
  SUBMITTED_FOR_REVIEW: ['PUBLISHED', 'DRAFT'],
  PUBLISHED: ['ON_SALE'],
  ON_SALE: ['SALES_PAUSED', 'SOUNDCHECK'],
  SALES_PAUSED: ['ON_SALE', 'SOUNDCHECK'],
  SOUNDCHECK: ['DOORS_OPEN'],
  DOORS_OPEN: ['LIVE'],
  LIVE: ['ENDED'],
  ENDED: ['SETTLEMENT_HOLD'],
  SETTLEMENT_HOLD: ['SETTLED'],
  SETTLED: ['ARCHIVED'],
  REFUNDING: ['SETTLED'],
  CANCELLED: ['REFUNDING', 'ARCHIVED'],
  ARCHIVED: [],
}

const TRANSITIONS: Record<EventStatus, EventStatus[]> = Object.fromEntries(
  Object.entries(BASE_TRANSITIONS).map(([from, tos]) => [
    from,
    CANCELLABLE.includes(from as EventStatus) ? [...tos, 'CANCELLED'] : tos,
  ]),
) as Record<EventStatus, EventStatus[]>

export const ALL_STATUSES = Object.keys(BASE_TRANSITIONS) as EventStatus[]

export function canTransition(from: EventStatus, to: EventStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

export function assertTransition(from: EventStatus, to: EventStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal event transition: ${from} -> ${to}`)
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/attend/events/lifecycle.test.ts`
Expected: PASS — all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/attend/events/lifecycle.ts src/lib/attend/events/lifecycle.test.ts
git commit -m "feat(attend): add the event lifecycle state machine"
```

### Task 5: Event slug generation (test-driven)

**Files:**
- Create: `src/lib/attend/events/slug.ts`
- Test: `src/lib/attend/events/slug.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/attend/events/slug.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { slugifyTitle, uniqueSlug } from '@/lib/attend/events/slug'

describe('slugifyTitle', () => {
  it('lowercases, trims, and hyphenates', () => {
    expect(slugifyTitle('  Midnight Live!  ')).toBe('midnight-live')
    expect(slugifyTitle('AI & Friends: Show #2')).toBe('ai-friends-show-2')
  })
  it('collapses repeated separators', () => {
    expect(slugifyTitle('a   ---   b')).toBe('a-b')
  })
  it('falls back for an empty result', () => {
    expect(slugifyTitle('!!!')).toBe('event')
  })
})

describe('uniqueSlug', () => {
  it('returns the base slug when it is free', () => {
    expect(uniqueSlug('midnight-live', [])).toBe('midnight-live')
  })
  it('appends the smallest free numeric suffix on collision', () => {
    expect(uniqueSlug('midnight-live', ['midnight-live'])).toBe('midnight-live-2')
    expect(uniqueSlug('midnight-live', ['midnight-live', 'midnight-live-2'])).toBe('midnight-live-3')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/attend/events/slug.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/lib/attend/events/slug.ts`:

```ts
// Event slug generation for HYVE Attend.

/** Lowercase, strip punctuation, hyphenate. Falls back to 'event'. */
export function slugifyTitle(title: string): string {
  const s = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s.length > 0 ? s : 'event'
}

/** The base slug, or base-N where N is the smallest free suffix >= 2. */
export function uniqueSlug(base: string, taken: string[]): string {
  if (!taken.includes(base)) return base
  let n = 2
  while (taken.includes(`${base}-${n}`)) n++
  return `${base}-${n}`
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/attend/events/slug.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/attend/events/slug.ts src/lib/attend/events/slug.test.ts
git commit -m "feat(attend): add event slug generation"
```

---

## Chunk 3: Event & ticket-type CRUD

### Task 6: Events repository

**Files:**
- Create: `src/lib/attend/events/repository.ts`

- [ ] **Step 1: Write the repository**

Create `src/lib/attend/events/repository.ts` — raw-REST queries over `attend_events` using `supaGet/supaPost/supaPatch` from `@/lib/supabase`. Functions, each checking `res.ok`:
- `insertEvent(row): Promise<EventRow>` — `supaPost('attend_events', row)`, returns the created row.
- `getEventById(id): Promise<EventRow | null>`.
- `getEventBySlug(slug): Promise<EventRow | null>`.
- `listEventsByCreator(creatorId): Promise<EventRow[]>` — `order=created_at.desc`.
- `listSlugsLike(base): Promise<string[]>` — `slug=like.${base}*&select=slug`, for `uniqueSlug`.
- `updateEvent(id, patch): Promise<void>` — `supaPatch` with `updated_at: new Date().toISOString()`.
Define and export an `EventRow` type matching the `attend_events` columns (spec §5.2). Keep this file query-only — no business logic.

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/attend/events/repository.ts
git commit -m "feat(attend): add events repository"
```

### Task 7: Events service

**Files:**
- Create: `src/lib/attend/events/service.ts`

- [ ] **Step 1: Write the service**

Create `src/lib/attend/events/service.ts` — the `events` business logic, depending on `repository.ts`, `lifecycle.ts`, and `slug.ts`:
- `createDraftEvent(creatorId, input): Promise<EventRow>` — validate required fields (`title`, `show_type`, `starts_at`, `ends_at`, `timezone`); generate the slug via `slugifyTitle` then `uniqueSlug` (passing `listSlugsLike` results); insert with `status: 'DRAFT'`, `creator_id: creatorId`, `created_by: creatorId`. Reject if `show_type` is one of `AI_SCHEDULED_PERFORMANCE`/`HYBRID_HUMAN_AI` (not built in the MVP — spec §2.3).
- `updateEventDetails(id, creatorId, patch): Promise<void>` — load the event; if `event.creator_id !== creatorId` throw a `ForbiddenError`; allow editing detail fields (`title`, `description`, `starts_at`, `ends_at`, `timezone`, `visibility`, `policy_text`, `refund_cutoff_hours`, `transfer_cutoff_hours`) **only while `status === 'DRAFT'`** — otherwise throw. Do not let detail edits change `status`.
- `changeEventStatus(id, creatorId, to): Promise<void>` — load the event; ownership check; `assertTransition(event.status, to)` from `lifecycle.ts`; then `updateEvent(id, { status: to })`. (Guard *conditions* like "$50 paid" arrive in plan 2b; this slice only wires the topology check.)
- `getCreatorEvent(id, creatorId)` and `listMyEvents(creatorId)` — read helpers with the ownership check.
Export typed `EventInput` and a `ForbiddenError` class. Keep all DB access delegated to the repository.

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/attend/events/service.ts
git commit -m "feat(attend): add events service"
```

### Task 8: Event API routes

**Files:**
- Create: `src/app/api/attend/events/route.ts`
- Create: `src/app/api/attend/events/[id]/route.ts`

- [ ] **Step 1: Write `/api/attend/events`**

Create `src/app/api/attend/events/route.ts`:
- `export const runtime = 'nodejs'`.
- `POST` — `requireCreator()`; `401` if null. Parse + validate the JSON body into `EventInput`; `400` on bad input. Call `createDraftEvent(profile.id, input)`; return `NextResponse.json(event, { status: 201 })`.
- `GET` — `requireCreator()`; `401` if null. Return `listMyEvents(profile.id)`.
Wrap service calls in try/catch; map `ForbiddenError` → `403`, validation errors → `400`, anything else → `500` with a logged `[attend events]` message.

- [ ] **Step 2: Write `/api/attend/events/[id]`**

Create `src/app/api/attend/events/[id]/route.ts`:
- `GET` — `requireCreator()`; return `getCreatorEvent(params.id, profile.id)` or `404`.
- `PATCH` — `requireCreator()`; read the body. If it contains a `status` field, call `changeEventStatus`; otherwise call `updateEventDetails`. Map errors as in Step 1. Return `{ ok: true }`.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build succeeds; `/api/attend/events` and `/api/attend/events/[id]` present.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/attend/events
git commit -m "feat(attend): add event create/update/list API routes"
```

### Task 9: Ticket-type repository + service

**Files:**
- Create: `src/lib/attend/ticketing/ticket-type-repository.ts`
- Create: `src/lib/attend/ticketing/ticket-type-service.ts`

- [ ] **Step 1: Write the repository**

Create `src/lib/attend/ticketing/ticket-type-repository.ts` — raw-REST over `attend_ticket_types`: `insertTicketType`, `listTicketTypesByEvent(eventId)`, `getTicketTypeById(id)`, `updateTicketType(id, patch)`, `deleteTicketType(id)` (hard delete is fine — a ticket type with no sales). Export a `TicketTypeRow` type (spec §5.2). Query-only.

- [ ] **Step 2: Write the service**

Create `src/lib/attend/ticketing/ticket-type-service.ts`:
- `addTicketType(eventId, creatorId, input)` — load the event via the events repository; ownership check; require `event.status === 'DRAFT'`; validate `price_cents >= 0` (integer), `quantity_total >= 0`, `max_per_order > 0`, non-empty `name`; insert with `quantity_sold: 0`.
- `editTicketType(id, creatorId, patch)` — load type → event; ownership check; `DRAFT`-only; same validation.
- `removeTicketType(id, creatorId)` — ownership check; `DRAFT`-only; delete.
- `listEventTicketTypes(eventId, creatorId)` — ownership check; return the list.
Reuse `ForbiddenError` from the events service.

- [ ] **Step 3: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/attend/ticketing
git commit -m "feat(attend): add ticket-type repository and service"
```

### Task 10: Ticket-type API routes

**Files:**
- Create: `src/app/api/attend/events/[id]/ticket-types/route.ts`
- Create: `src/app/api/attend/ticket-types/[id]/route.ts`

- [ ] **Step 1: Write the routes**

`events/[id]/ticket-types/route.ts`: `POST` (→ `addTicketType(params.id, ...)`) and `GET` (→ `listEventTicketTypes`). `ticket-types/[id]/route.ts`: `PATCH` (→ `editTicketType`) and `DELETE` (→ `removeTicketType`). All: `requireCreator()` → `401`; error mapping as in Task 8 (`ForbiddenError` → `403`, validation → `400`).

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: build succeeds; both routes present.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/attend/events src/app/api/attend/ticket-types
git commit -m "feat(attend): add ticket-type API routes"
```

### Task 11: Minimal creator events page

A small page so the chunk is exercisable end-to-end: list the creator's events and a create-event form. The full dashboard is plan 2c.

**Files:**
- Create: `src/app/attend/(creator)/creator/page.tsx`
- Create: `src/app/attend/(creator)/creator/creator-events-client.tsx`

- [ ] **Step 1: Write the page shell (Server Component)**

Create `src/app/attend/(creator)/creator/page.tsx` — calls `requireCreator()`; if null, `redirect('/attend/login')`; otherwise fetch the creator's events via `listMyEvents(profile.id)` and render `<CreatorEventsClient events={events} />`.

- [ ] **Step 2: Write the client component**

Create `creator-events-client.tsx` (`'use client'`) — renders the events list (title + status badge) and a create-event form (title, show type select limited to `HUMAN_LIVE_BROADCAST`/`FREE_EVENT`/`PRIVATE_EVENT`, start/end datetime, timezone). On submit: `POST /api/attend/events`; on success `window.location.reload()`; on error show the message. Repo styling conventions.

- [ ] **Step 3: Verify build + manual check**

Run: `npm run build` — succeeds, `/attend/creator` present.
Then `npm run dev`, sign up at `/attend/signup`, and confirm `/attend/creator` loads, a created event appears in the list, and a second event with the same title gets a `-2` slug.

- [ ] **Step 4: Commit**

```bash
git add "src/app/attend/(creator)"
git commit -m "feat(attend): add minimal creator events page"
```

---

## Phase 2a completion check

- `npm test` passes — Phase 1 tests plus the new `lifecycle` and `slug` suites.
- `npm run build` succeeds; `/attend/signup`, `/attend/login`, `/attend/creator`, and the `/api/attend/events*` + `/api/attend/ticket-types*` routes are present.
- A new user can sign up, is provisioned an `attend_profiles` row, is promoted to `CREATOR` on first creator action, and can create + edit a `DRAFT` event and its ticket types.
- The event lifecycle state machine rejects illegal transitions (unit-tested against the full §6.9 table).
- Additive only: every file is new except `.env.local`/`.env.example` (the two `NEXT_PUBLIC_SUPABASE_*` vars). No existing product or route is modified.

**Next:** Plan 2b — the $50 registration charge (`attend_pay_registration` + Stripe one-time checkout) and Stripe Connect Express onboarding.
