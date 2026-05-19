# HYVE Attend — Phase 3a: Discovery + Event Page Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax. Executed in-session against the `attend-phase-3a-discovery` branch.

**Goal:** Buyers can browse discoverable events at `/attend` and view an event's full page at `/attend/events/[slug]` — hero, artist, localized date/time, ticket tiers with all-in prices, and policy.

**Architecture:** A new `discovery` module composes buyer-facing reads (events + ticket types + artist) from existing repositories. Two new public, server-rendered pages fetch through it. No auth, no writes — Phase 3a is the read-only front of the buyer flow. Checkout (the buy button, `attend_create_pending_order`, Stripe) is Phase 3b; the wallet is Phase 3c.

**Tech Stack:** Next.js 14 App Router, TypeScript (strict), Tailwind, Vitest. Raw-REST Supabase reads via the service key — **server-side only** (the key must never reach the browser).

---

## Context for the executor

Phases 1–2c are merged: the creator can create events, set ticket types, and walk the setup chain. **No buyer-facing pages exist yet** — `src/app/attend/page.tsx` is a placeholder; there is no `/attend/events` route.

**Schema (already migrated):**
- `attend_events` — `id, slug, creator_id, title, description, show_type, status, starts_at, ends_at, timezone, visibility, hero_media_id, refund_cutoff_hours, transfer_cutoff_hours, policy_text, …`. `EventRow` in `events/repository.ts` types it.
- `attend_ticket_types` — `id, event_id, name, kind, price_cents, currency, quantity_total, quantity_sold, max_per_order, sales_start_at, sales_end_at, status` (`status` ∈ `ACTIVE,PAUSED,SOLD_OUT,HIDDEN`). `TicketTypeRow` in `ticketing/ticket-type-repository.ts`.
- `attend_profiles` — `id, display_name, email, role, avatar_url`.
- `attend_artist_profiles` — `id, profile_id (unique → attend_profiles), stage_name, bio, avatar_url, links`.

**Decisions baked into this plan:**
- **Discoverable statuses:** `PUBLISHED, ON_SALE, SALES_PAUSED, SOUNDCHECK, DOORS_OPEN, LIVE` — and `visibility = 'PUBLIC'` (private events are not discoverable). Setup/DRAFT and ENDED-onward are excluded. This set is defined **once** in `lifecycle.ts` and reused by both the discovery query and the event-page gate.
- **All-in price = `price_cents`.** `fee_mode` lives on `attend_orders` and defaults to `ABSORB`; under ABSORB with 0 tax the buyer pays exactly the ticket price. The event page shows `formatUsd(price_cents)` per tier with an "all prices final — no fees added at checkout" line. The itemized fee breakdown belongs in 3b checkout (quantities × price), not here — do **not** call the fee calculator per tier (it is a no-op under ABSORB/0-tax).
- **Hero media is deferred.** No creator phase built a media-upload UI, so `hero_media_id` is always `null`. The event page renders a styled placeholder hero — do not build `attend_event_media` fetch logic for data that cannot exist yet.
- **Featured row is deferred.** `attend_promotion_campaigns` has no curation in the MVP (every paid event auto-gets an `ACTIVE` campaign), so a featured row would be indistinguishable from the main list. Discovery ships as **Live now** + **Upcoming**, filterable by show type.

## File Structure

**Create:**
- `src/lib/attend/identity/profile-repository.ts` — `getProfileById`, `getArtistProfileByProfileId`.
- `src/lib/attend/discovery/discovery-service.ts` — `getDiscoveryFeed()`, `getEventPage(slug)`.
- `src/app/attend/discovery-client.tsx` — client component: show-type filter + event-card grid.
- `src/app/attend/events/[slug]/page.tsx` — the event page (pure server component).

**Modify:**
- `src/lib/attend/events/lifecycle.ts` — add `DISCOVERABLE_STATUSES`, `isDiscoverable()`, `eventTiming()`.
- `src/lib/attend/events/lifecycle.test.ts` — tests for the new helpers.
- `src/lib/attend/events/repository.ts` — add `listDiscoverableEvents()`.
- `src/app/attend/page.tsx` — replace the placeholder with the discovery page (server component).

---

## Task 1: Discoverable-status helpers + events query

**Files:**
- Modify: `src/lib/attend/events/lifecycle.ts`
- Modify: `src/lib/attend/events/lifecycle.test.ts`
- Modify: `src/lib/attend/events/repository.ts`

`lifecycle.ts` already owns pure status-domain helpers (`draftTargetStatus`); these join it. Keeping them there — rather than in the `discovery` module — avoids an upward import: `events/repository.ts` and `discovery` both depend on `events`, never the reverse.

- [ ] **Step 1: Write the failing tests** — append to `lifecycle.test.ts`; extend the existing `lifecycle` import to also bring in `DISCOVERABLE_STATUSES`, `isDiscoverable`, `eventTiming`:

```ts
describe('discoverability + timing', () => {
  it('isDiscoverable matches the discoverable status set', () => {
    for (const s of DISCOVERABLE_STATUSES) expect(isDiscoverable(s)).toBe(true)
    expect(isDiscoverable('DRAFT')).toBe(false)
    expect(isDiscoverable('ENDED')).toBe(false)
  })
  it('eventTiming buckets show-day statuses as LIVE, the rest as UPCOMING', () => {
    for (const s of ['SOUNDCHECK', 'DOORS_OPEN', 'LIVE'] as const) {
      expect(eventTiming(s)).toBe('LIVE')
    }
    for (const s of ['PUBLISHED', 'ON_SALE', 'SALES_PAUSED'] as const) {
      expect(eventTiming(s)).toBe('UPCOMING')
    }
  })
})
```

- [ ] **Step 2: Run, expect FAIL** (the helpers are not exported).

- [ ] **Step 3: Add the helpers to `lifecycle.ts`.** `DISCOVERABLE_STATUSES` is the single source of truth — both the query (Step 5) and the event-page gate (Task 3) derive from it:

```ts
// Statuses at which a buyer may discover and view an event (spec §7).
export const DISCOVERABLE_STATUSES: EventStatus[] = [
  'PUBLISHED', 'ON_SALE', 'SALES_PAUSED', 'SOUNDCHECK', 'DOORS_OPEN', 'LIVE',
]

export function isDiscoverable(status: EventStatus): boolean {
  return DISCOVERABLE_STATUSES.includes(status)
}

export type EventTiming = 'LIVE' | 'UPCOMING'

// A discoverable event is either happening now or still upcoming — the two
// sections the discovery page renders.
const LIVE_STATUSES: EventStatus[] = ['SOUNDCHECK', 'DOORS_OPEN', 'LIVE']
export function eventTiming(status: EventStatus): EventTiming {
  return LIVE_STATUSES.includes(status) ? 'LIVE' : 'UPCOMING'
}
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Add `listDiscoverableEvents` to `events/repository.ts`** — import `DISCOVERABLE_STATUSES` from lifecycle (the repo already imports `EventStatus` from there); derive the filter, no duplicated list:

```ts
/** Events a buyer may browse: public, in a discoverable status, soonest first. */
export async function listDiscoverableEvents(): Promise<EventRow[]> {
  return rows(
    await supaGet(
      'attend_events',
      `status=in.(${DISCOVERABLE_STATUSES.join(',')})&visibility=eq.PUBLIC` +
        `&deleted_at=is.null&select=*&order=starts_at.asc`,
    ),
  )
}
```

- [ ] **Step 6: Verify** — `npx tsc --noEmit`; `npm test` green.
- [ ] **Step 7: Commit** — `feat(attend): add discoverable-status helpers + events query (Phase 3a task 1)`.

---

## Task 2: Profile + artist repository

**Files:**
- Create: `src/lib/attend/identity/profile-repository.ts`

- [ ] **Step 1: Build it.** Raw-REST reads, query-only, mirroring `events/repository.ts` style (a `rows()`-style guard, `null` on empty, throw on non-OK). Define and export:
  - `ProfileRow` — `{ id, display_name, email, role, avatar_url }` (`avatar_url: string | null`).
  - `ArtistProfileRow` — `{ id, profile_id, stage_name, bio, avatar_url, links }` (`bio`/`avatar_url` nullable; `links` `Record<string, unknown>`).
  - `getProfileById(id: string): Promise<ProfileRow | null>` — `attend_profiles?id=eq.…&select=*`.
  - `getArtistProfileByProfileId(profileId: string): Promise<ArtistProfileRow | null>` — `attend_artist_profiles?profile_id=eq.…&select=*`.

- [ ] **Step 2: Verify** — `npx tsc --noEmit`.
- [ ] **Step 3: Commit** — `feat(attend): add the profile + artist repository (Phase 3a task 2)`.

---

## Task 3: Discovery service

**Files:**
- Create: `src/lib/attend/discovery/discovery-service.ts`

- [ ] **Step 1: Build the service.** It composes repositories for the buyer pages. No auth (public). Export:

  - `getDiscoveryFeed(): Promise<{ live: EventRow[]; upcoming: EventRow[] }>` — calls `listDiscoverableEvents()`, partitions with `eventTiming`.

  - `getEventPage(slug)` — returns `null` when the event is missing, soft-deleted, or **not `isDiscoverable(event.status)`** (a `DRAFT`/setup event must not be viewable by slug; use the `isDiscoverable` helper from `lifecycle.ts`, not a re-listed set). Otherwise returns:
    ```ts
    {
      event: EventRow
      ticketTypes: TicketTypeRow[]   // listTicketTypesByEvent, excluding only status 'HIDDEN'
      artist: { name: string; bio: string | null; avatarUrl: string | null }
    }
    ```
    **Show `SOLD_OUT` and `PAUSED` tiers** — buyers need to see a sold-out tier; only `HIDDEN` is filtered out. The `artist` is composed: `getArtistProfileByProfileId(event.creator_id)` → use `stage_name/bio/avatar_url` if present; otherwise fall back to `getProfileById(event.creator_id)` → `display_name` (name only, `bio`/`avatarUrl` null). If neither exists, `name` is `'Artist'`.

- [ ] **Step 2: Verify** — `npx tsc --noEmit`.
- [ ] **Step 3: Commit** — `feat(attend): add the discovery service (Phase 3a task 3)`.

---

## Task 4: Discovery page

**Files:**
- Modify: `src/app/attend/page.tsx`
- Create: `src/app/attend/discovery-client.tsx`

- [ ] **Step 1: `page.tsx`** — server component: `export const dynamic = 'force-dynamic'`; `await getDiscoveryFeed()`; render `<DiscoveryClient live={…} upcoming={…} />`.

- [ ] **Step 2: `discovery-client.tsx`** — `'use client'`. Props `{ live: EventRow[]; upcoming: EventRow[] }`. A show-type filter (`All` + the three MVP types) held in `useState`, applied client-side. Define a **local `SHOW_TYPES` label constant** by copying the one in `creator-events-client.tsx` — the codebase keeps UI label lists local per component (see also `ticket-types-panel.tsx`'s `TICKET_KINDS`); copy, do not export. Render a **Live now** section then an **Upcoming** section; within each, a responsive grid of event cards. Each card is a `next/link` to `/attend/events/${ev.slug}` showing title, show-type label, a `LIVE`/date badge, and the wall-clock start (`ev.starts_at?.slice(0,16).replace('T',' ')`). Empty states: "No live events right now", "No upcoming events yet". Reuse the dark palette (`#08070a`/`#111111`/`#2a2135`/`#E8C456`/`#ede8d8`/`#9e8a55`).

- [ ] **Step 3: Verify** — `npx tsc --noEmit`; `npm run build` lists `/attend`.
- [ ] **Step 4: Commit** — `feat(attend): add the discovery page (Phase 3a task 4)`.

---

## Task 5: Event page

**Files:**
- Create: `src/app/attend/events/[slug]/page.tsx`

- [ ] **Step 1: Build the page** — a pure server component (no client JS needed in 3a). `export const dynamic = 'force-dynamic'`. `const data = await getEventPage(params.slug)`; if `null`, call `notFound()` (from `next/navigation`). Render:
  - A **placeholder hero** — a gradient band (`from-[#2a2135] to-[#08070a]`) with the event title overlaid. No image fetch (hero media deferred).
  - **Artist** — `data.artist.name`, optional `bio`, optional `avatarUrl` (use a plain `<img>` — avoids `next.config` image-domain config).
  - **Date/time** — `starts_at`/`ends_at` shown as wall-clock (`slice(0,16).replace('T',' ')`) plus the `timezone` string. (Viewer-localized formatting is a fast-follow; wall-clock + tz label is consistent with the creator dashboard.)
  - **Ticket tiers** — each `data.ticketTypes` row: name, kind, `formatUsd(price_cents)`, and a "Sold out" marker when `status === 'SOLD_OUT'`. Below the list: "All prices are final — no fees are added at checkout." If `ticketTypes` is empty: "Tickets not yet listed."
  - **Policy** — `event.policy_text` if present, plus the refund/transfer cutoff hours.
  - **Add to calendar** — a plain `<a>` to a Google Calendar template URL (`https://calendar.google.com/calendar/render?action=TEMPLATE&text=…&dates=…`); build `dates` from `starts_at`/`ends_at` compacted to `YYYYMMDDTHHMMSSZ`. If either is null, omit the link.
  - **No buy button in 3a** — checkout is Phase 3b. A short status line ("On sale" etc.) is enough; the buy CTA arrives with checkout.

- [ ] **Step 2: Verify** — `npx tsc --noEmit`; `npm run build` lists `/attend/events/[slug]`.
- [ ] **Step 3: Commit** — `feat(attend): add the event page (Phase 3a task 5)`.

---

## Verification checklist (whole phase)

- [ ] `npx tsc --noEmit` clean; `npm test` green (incl. new lifecycle tests); `npm run build` succeeds, lists `/attend` and `/attend/events/[slug]`, no existing route changed.
- [ ] Service-key Supabase reads happen only in server components / the service layer — never shipped to the client bundle.
- [ ] A `DRAFT` or `PRIVATE` event is not reachable via `/attend/events/[slug]` (`getEventPage` returns `null` → `notFound()`).
- [ ] No new dependencies; no shared-file edits.

## Notes

- **DRY/YAGNI:** no featured row, no hero-media fetch, no per-tier fee calculator, no buy button — each deferred to the phase that gives it real data or meaning.
- Phase 3a is read-only and unauthenticated; the first buyer **write** path (`attend_create_pending_order`) is Phase 3b.
