# HYVE Attend Phase 6e: Promotion Engine — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the $50 registration fee into a working promotion product — a starter ad creative the creator can edit, a real internal "Featured" placement on the discovery page, and a promotion analytics dashboard.

**Architecture:** A new isolated `src/lib/attend/promotion/` module. The starter-creative copy is one pure, unit-tested function. The promotion campaign row already exists (created by `attend_pay_registration` with its budget ledger) — Phase 6e adds the creative, the placement, and the metrics. One small RPC atomically increments placement counters. Internal placements are free; the $50 budget is reserved for external ad spend (a later integration).

**Tech Stack:** Next.js 14 App Router, TypeScript (strict), Supabase raw-REST + plpgsql RPCs, Vitest.

---

## Chunk 1: Promotion engine end to end

### Scope & isolation

Phase 6e is purely additive. New files plus two Attend-owned files modified: `src/app/attend/discovery-client.tsx` (a Featured row) and `src/app/attend/(creator)/creator/events/[id]/page.tsx` (a Promotion link). The discovery service gains a `featured` field. Migration 031 is a new file.

**Already in place (not rebuilt):** `attend_promotion_campaigns` (created per event by `attend_pay_registration`, `budget_cents` 5000, `status` ACTIVE) and the `PROMOTION_REGISTRATION_FEE` / `PROMOTION_BUDGET_ALLOCATED` ledger entries. §27's "basic promotion ledger" is already satisfied; 6e builds the engine on top.

**Scope boundary:** 6e ships ONE internal placement — the discovery Featured row. The other §19 placement ideas (category pages, email digests, notification slots) and all external ad-network integration are deferred. "Conversions" is the count of tickets sold for the event (a proxy, not click-attributed).

### File Structure

**New files:**

- `supabase/migrations/031_attend_promotion.sql` — creative columns on `attend_promotion_campaigns`, a unique index on `attend_promotion_spend`, and the `attend_track_promotion` RPC.
- `src/lib/attend/promotion/promotion-copy.ts` + `.test.ts` — the pure starter-creative generator.
- `src/lib/attend/promotion/promotion-repository.ts` — raw-REST data access.
- `src/lib/attend/promotion/promotion-service.ts` — orchestration: creator dashboard, creative save, featured events, metric tracking.
- `src/app/api/attend/promotion/impressions/route.ts` — `POST`, the featured-row impression beacon.
- `src/app/api/attend/promotion/[id]/click/route.ts` — `GET`, a click-tracking redirect.
- `src/app/attend/(creator)/creator/events/[id]/promotion/page.tsx` + `promotion-client.tsx` — the creator promotion dashboard.

**Modified files (both Attend-owned):**

- `src/app/attend/discovery-client.tsx` — adds the Featured row + the impression beacon.
- `src/app/attend/(creator)/creator/events/[id]/page.tsx` — adds a "Promotion" link.

The discovery service (`src/lib/attend/discovery/discovery-service.ts`) also gains a `featured` field — it is Attend-owned.

### Conventions confirmed from the codebase

- RPCs: `create or replace function attend_*(p_args jsonb) returns jsonb language plpgsql`; a user-facing/benign failure returns `{ ok: false, error }`. Applied via the Supabase MCP `apply_migration` tool — project ref `jlyqezwuyhfevrdomazd`.
- Only pure logic is unit-tested. Phase 6e's only test file is `promotion-copy.test.ts`.
- `requireCreator` is from `@/lib/attend/identity/roles`; `getCreatorEvent` (throws `ForbiddenError`/`NotFoundError`) from `@/lib/attend/events/service`; `DISCOVERABLE_STATUSES` from `@/lib/attend/events/lifecycle`.
- Schema facts (migration 013): `attend_promotion_campaigns` — `id, event_id (unique), budget_cents, status (ACTIVE/PAUSED/EXHAUSTED/CLOSED), created_at, updated_at`. `attend_promotion_spend` — `id, campaign_id, kind (INTERNAL_PLACEMENT/EXTERNAL), amount_cents, impressions, clicks, conversions, recorded_at, created_at`.

---

### Task 1: Starter creative generator

The §19 centerpiece — a pure function that turns event details into starter ad copy, in the calm §32 product tone.

**Files:**
- Create: `src/lib/attend/promotion/promotion-copy.ts`
- Test: `src/lib/attend/promotion/promotion-copy.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/attend/promotion/promotion-copy.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { generateStarterCreative } from '@/lib/attend/promotion/promotion-copy'

describe('generateStarterCreative', () => {
  it('builds a headline from the event title', () => {
    const c = generateStarterCreative({
      title: 'Midnight Set',
      description: null,    })
    expect(c.headline).toBe('Midnight Set — live on HYVE')
  })

  it('uses the description for the body when present', () => {
    const c = generateStarterCreative({
      title: 'Midnight Set',
      description: '  A late-night ambient session.  ',    })
    expect(c.body).toBe('A late-night ambient session.')
  })

  it('falls back to a generated body when there is no description', () => {
    const c = generateStarterCreative({
      title: 'Midnight Set',
      description: null,    })
    expect(c.body).toContain('Midnight Set')
    expect(c.body.length).toBeGreaterThan(0)
  })

  it('clamps a very long title in the headline', () => {
    const c = generateStarterCreative({
      title: 'X'.repeat(200),
      description: null,    })
    expect(c.headline.length).toBeLessThanOrEqual(80)
    expect(c.headline.endsWith('…')).toBe(true)
  })

  it('clamps a very long description in the body', () => {
    const c = generateStarterCreative({
      title: 'Set',
      description: 'word '.repeat(100),    })
    expect(c.body.length).toBeLessThanOrEqual(180)
  })

  it('normalises whitespace and tolerates an empty title', () => {
    const c = generateStarterCreative({
      title: '   ',
      description: 'line\n\nbreak',    })
    expect(c.headline).toBe('A live show — live on HYVE')
    expect(c.body).toBe('line break')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/attend/promotion/promotion-copy.test.ts`
Expected: FAIL — cannot resolve the module.

- [ ] **Step 3: Write the implementation**

Create `src/lib/attend/promotion/promotion-copy.ts`:

```ts
// HYVE Attend promotion copy — turns event details into a starter ad creative
// (spec §19). Pure and deterministic; the tone follows §32 (calm, modern,
// human — no hype). The creator edits this freely afterwards.

export interface CreativeEventInput {
  title: string
  description: string | null
}

export interface AdCreative {
  headline: string
  body: string
}

const HEADLINE_MAX = 80
const BODY_MAX = 180

// Trim, collapse internal whitespace, and clamp to a length with an ellipsis.
function clamp(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, ' ')
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`
}

/** A starter headline + body for an event's promotion campaign. */
export function generateStarterCreative(e: CreativeEventInput): AdCreative {
  const title = e.title.trim().replace(/\s+/g, ' ') || 'A live show'
  const headline = clamp(`${title} — live on HYVE`, HEADLINE_MAX)
  const description = e.description?.trim()
  const body = description
    ? clamp(description, BODY_MAX)
    : clamp(
        `Join ${title} live from any browser. Reserve your ticket on HYVE Attend.`,
        BODY_MAX,
      )
  return { headline, body }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/attend/promotion/promotion-copy.test.ts`
Expected: PASS — 6/6.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/attend/promotion/promotion-copy.ts src/lib/attend/promotion/promotion-copy.test.ts
git commit -m "feat(attend): add promotion copy generator (Phase 6e task 1)"
```

---

### Task 2: Migration 031 — promotion creative + tracking

Adds the creative columns to `attend_promotion_campaigns`, a unique index so each campaign has exactly one internal-placement spend row, and `attend_track_promotion` — an RPC that atomically increments an impression/click counter.

**Files:**
- Create: `supabase/migrations/031_attend_promotion.sql`

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/031_attend_promotion.sql`:

```sql
-- HYVE Attend — promotion engine (spec §19). The campaign row + budget ledger
-- already exist (attend_pay_registration); this adds the editable ad creative,
-- a unique internal-placement spend row per campaign, and a counter RPC.

alter table attend_promotion_campaigns add column if not exists headline text;
alter table attend_promotion_campaigns add column if not exists body text;
alter table attend_promotion_campaigns
  add column if not exists creative_approved boolean not null default false;

-- One INTERNAL_PLACEMENT spend row per campaign — the counter target.
create unique index if not exists idx_attend_promo_spend_campaign_kind
  on attend_promotion_spend (campaign_id, kind);

-- attend_track_promotion atomically bumps an impression or click counter on
-- the campaign's internal-placement spend row, creating that row on first use.
-- Structured { ok, error? } return — a bad metric or missing campaign is not
-- an exception (the caller is a fire-and-forget tracking beacon).
create or replace function attend_track_promotion(p_args jsonb)
returns jsonb language plpgsql as $$
declare
  v_campaign uuid := (p_args->>'campaign_id')::uuid;
  v_metric   text := p_args->>'metric';
  v_count    int  := greatest(1, coalesce((p_args->>'count')::int, 1));
  v_spend_id uuid;
begin
  if v_metric not in ('impressions', 'clicks') then
    return jsonb_build_object('ok', false, 'error', 'bad metric');
  end if;
  if not exists (select 1 from attend_promotion_campaigns where id = v_campaign) then
    return jsonb_build_object('ok', false, 'error', 'campaign not found');
  end if;

  insert into attend_promotion_spend (campaign_id, kind)
  values (v_campaign, 'INTERNAL_PLACEMENT')
  on conflict (campaign_id, kind) do nothing;
  select id into v_spend_id from attend_promotion_spend
   where campaign_id = v_campaign and kind = 'INTERNAL_PLACEMENT';

  if v_metric = 'impressions' then
    update attend_promotion_spend set impressions = impressions + v_count
     where id = v_spend_id;
  else
    update attend_promotion_spend set clicks = clicks + v_count
     where id = v_spend_id;
  end if;

  return jsonb_build_object('ok', true);
end $$;
```

- [ ] **Step 2: Apply the migration**

Apply with the Supabase MCP `apply_migration` tool — project ref `jlyqezwuyhfevrdomazd`, name `attend_promotion`, contents = the file above.

- [ ] **Step 3: Verify the migration applied**

Run with the Supabase MCP `execute_sql` tool:

```sql
select
  (select count(*) from information_schema.columns
     where table_name = 'attend_promotion_campaigns'
       and column_name in ('headline','body','creative_approved')) as cols,
  (select count(*) from pg_proc where proname = 'attend_track_promotion') as fn;
```

Expected: one row, `cols = 3`, `fn = 1`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/031_attend_promotion.sql
git commit -m "feat(attend): add promotion creative + tracking RPC (Phase 6e task 2)"
```

---

### Task 3: Promotion repository

Raw-REST data access: the campaign for an event, the featured campaigns (ACTIVE, on a publicly-discoverable event), the internal-placement spend row, and the sold-ticket count (the conversions proxy).

**Files:**
- Create: `src/lib/attend/promotion/promotion-repository.ts`

- [ ] **Step 1: Write the repository**

Create `src/lib/attend/promotion/promotion-repository.ts`:

```ts
// Raw-REST data access for the HYVE Attend promotion tables. Query-only — no
// business logic. Server-side only (service-key reads).
import { supaGet, supaPatch } from '@/lib/supabase'
import { DISCOVERABLE_STATUSES } from '@/lib/attend/events/lifecycle'
import type { EventRow } from '@/lib/attend/events/repository'

export interface CampaignRow {
  id: string
  event_id: string
  budget_cents: number
  status: string
  headline: string | null
  body: string | null
  creative_approved: boolean
}

// An ACTIVE campaign with its (discoverable) event embedded — a featured slot.
export interface FeaturedCampaign {
  id: string
  headline: string | null
  attend_events: EventRow
}

export interface InternalSpend {
  impressions: number
  clicks: number
}

export async function getCampaignByEvent(eventId: string): Promise<CampaignRow | null> {
  const res = await supaGet(
    'attend_promotion_campaigns',
    `event_id=eq.${eventId}&select=id,event_id,budget_cents,status,headline,body,creative_approved`,
  )
  if (!res.ok) throw new Error(`attend_promotion_campaigns query failed: ${res.status}`)
  const rows = (await res.json()) as CampaignRow[]
  return rows[0] ?? null
}

export async function updateCampaign(
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const res = await supaPatch('attend_promotion_campaigns', `id=eq.${id}`, {
    ...patch,
    updated_at: new Date().toISOString(),
  })
  if (!res.ok) {
    throw new Error(`attend_promotion_campaigns update failed: ${res.status} ${await res.text()}`)
  }
}

/** ACTIVE campaigns whose event is public and in a buyer-discoverable status. */
export async function getFeaturedCampaigns(): Promise<FeaturedCampaign[]> {
  const res = await supaGet(
    'attend_promotion_campaigns',
    `status=eq.ACTIVE&select=id,headline,attend_events!inner(*)` +
      `&attend_events.status=in.(${DISCOVERABLE_STATUSES.join(',')})` +
      `&attend_events.visibility=eq.PUBLIC&attend_events.deleted_at=is.null`,
  )
  if (!res.ok) throw new Error(`featured campaigns query failed: ${res.status}`)
  return (await res.json()) as FeaturedCampaign[]
}

/** The campaign's internal-placement counters, or zeroes if none recorded yet. */
export async function getInternalSpend(campaignId: string): Promise<InternalSpend> {
  const res = await supaGet(
    'attend_promotion_spend',
    `campaign_id=eq.${campaignId}&kind=eq.INTERNAL_PLACEMENT&select=impressions,clicks`,
  )
  if (!res.ok) throw new Error(`attend_promotion_spend query failed: ${res.status}`)
  const rows = (await res.json()) as InternalSpend[]
  return rows[0] ?? { impressions: 0, clicks: 0 }
}

/** Count of tickets sold for an event — the conversions proxy (no cart holds). */
export async function countSoldTickets(eventId: string): Promise<number> {
  const res = await supaGet(
    'attend_tickets',
    `event_id=eq.${eventId}&state=in.(PURCHASED,ASSIGNED_TO_BUYER,` +
      `TRANSFER_PENDING_EMAIL,TRANSFER_PENDING_FRIEND_CODE,TRANSFER_ACCEPTED,` +
      `CHECKED_IN,IN_ROOM,USED,NO_SHOW)&select=id`,
  )
  if (!res.ok) throw new Error(`attend_tickets count query failed: ${res.status}`)
  return ((await res.json()) as unknown[]).length
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/attend/promotion/promotion-repository.ts
git commit -m "feat(attend): add promotion repository (Phase 6e task 3)"
```

---

### Task 4: Promotion service

Orchestration: the creator's promotion dashboard (campaign + lazily-generated creative + analytics), saving the creative, the featured-events list, and the metric trackers.

**Files:**
- Create: `src/lib/attend/promotion/promotion-service.ts`

- [ ] **Step 1: Write the service**

Create `src/lib/attend/promotion/promotion-service.ts`:

```ts
// HYVE Attend promotion — the engine on top of the registration-fee campaign
// (spec §19). The starter creative is generated lazily the first time the
// creator opens their promotion dashboard; internal placements are free, so
// the $50 budget stays whole and reserved for external ad spend.
import { generateStarterCreative } from '@/lib/attend/promotion/promotion-copy'
import {
  getCampaignByEvent,
  updateCampaign,
  getFeaturedCampaigns,
  getInternalSpend,
  countSoldTickets,
  type CampaignRow,
} from '@/lib/attend/promotion/promotion-repository'
import { getCreatorEvent, NotFoundError } from '@/lib/attend/events/service'
import type { EventRow } from '@/lib/attend/events/repository'
import { supaPost } from '@/lib/supabase'

export interface PromotionDashboard {
  campaignId: string
  headline: string
  body: string
  creativeApproved: boolean
  budgetCents: number
  impressions: number
  clicks: number
  conversions: number
}

export interface FeaturedEvent {
  campaignId: string
  headline: string | null
  event: EventRow
}

/**
 * The creator's promotion dashboard for one of their events. The starter
 * creative is generated and persisted on first view.
 */
export async function getPromotionDashboard(
  eventId: string,
  creatorId: string,
): Promise<PromotionDashboard> {
  const event = await getCreatorEvent(eventId, creatorId) // throws if not theirs
  let campaign = await getCampaignByEvent(eventId)
  if (!campaign) throw new NotFoundError('This event has no promotion campaign')

  campaign = await ensureCreative(campaign, event)
  const [spend, conversions] = await Promise.all([
    getInternalSpend(campaign.id),
    countSoldTickets(eventId),
  ])

  return {
    campaignId: campaign.id,
    headline: campaign.headline ?? '',
    body: campaign.body ?? '',
    creativeApproved: campaign.creative_approved,
    budgetCents: campaign.budget_cents,
    impressions: spend.impressions,
    clicks: spend.clicks,
    conversions,
  }
}

// Generate + persist the starter creative if the campaign has none yet. Two
// concurrent first-views can both generate and write — harmless: the generator
// is pure, so last-write-wins produces the identical creative.
async function ensureCreative(campaign: CampaignRow, event: EventRow): Promise<CampaignRow> {
  if (campaign.headline && campaign.body) return campaign
  const creative = generateStarterCreative({
    title: event.title,
    description: event.description,
  })
  await updateCampaign(campaign.id, { headline: creative.headline, body: creative.body })
  return { ...campaign, headline: creative.headline, body: creative.body }
}

/** Save the creator's edited creative for one of their events. */
export async function savePromotionCreative(
  eventId: string,
  creatorId: string,
  input: { headline: string; body: string; approved: boolean },
): Promise<void> {
  await getCreatorEvent(eventId, creatorId) // throws if not theirs
  const campaign = await getCampaignByEvent(eventId)
  if (!campaign) throw new NotFoundError('This event has no promotion campaign')
  await updateCampaign(campaign.id, {
    headline: input.headline.trim().slice(0, 200) || null,
    body: input.body.trim().slice(0, 600) || null,
    creative_approved: input.approved,
  })
}

/** The featured events for the discovery page. */
export async function getFeaturedEvents(): Promise<FeaturedEvent[]> {
  const campaigns = await getFeaturedCampaigns()
  return campaigns.map((c) => ({
    campaignId: c.id,
    headline: c.headline,
    event: c.attend_events,
  }))
}

/** Record one impression per campaign id (the discovery Featured-row beacon). */
export async function recordImpressions(campaignIds: string[]): Promise<void> {
  for (const id of campaignIds) {
    try {
      const res = await supaPost('rpc/attend_track_promotion', {
        p_args: { campaign_id: id, metric: 'impressions' },
      })
      if (!res.ok) console.error(`[promotion] impression failed for ${id}: ${res.status}`)
    } catch (err) {
      console.error('[promotion] impression error:', (err as Error).message)
    }
  }
}

/** Record one click on a campaign (the featured-card redirect). */
export async function recordClick(campaignId: string): Promise<void> {
  try {
    const res = await supaPost('rpc/attend_track_promotion', {
      p_args: { campaign_id: campaignId, metric: 'clicks' },
    })
    if (!res.ok) console.error(`[promotion] click failed for ${campaignId}: ${res.status}`)
  } catch (err) {
    console.error('[promotion] click error:', (err as Error).message)
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/attend/promotion/promotion-service.ts
git commit -m "feat(attend): add promotion service (Phase 6e task 4)"
```

---

### Task 5: Tracking routes

The impression beacon and the click-tracking redirect. Both are public (no auth) — they only ever increment a counter.

**Files:**
- Create: `src/app/api/attend/promotion/impressions/route.ts`
- Create: `src/app/api/attend/promotion/[id]/click/route.ts`

- [ ] **Step 1: Write the impression beacon**

Create `src/app/api/attend/promotion/impressions/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { recordImpressions } from '@/lib/attend/promotion/promotion-service'

export const runtime = 'nodejs'

// POST /api/attend/promotion/impressions — fire-and-forget beacon from the
// discovery Featured row. Body: { campaignIds: string[] }.
export async function POST(req: NextRequest) {
  let body: { campaignIds?: unknown }
  try {
    body = (await req.json()) as { campaignIds?: unknown }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const ids = Array.isArray(body.campaignIds)
    ? body.campaignIds.filter((x): x is string => typeof x === 'string').slice(0, 50)
    : []
  try {
    await recordImpressions(ids)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[promotion impressions]:', (err as Error).message)
    return NextResponse.json({ error: 'Tracking failed' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Write the click redirect**

Create `src/app/api/attend/promotion/[id]/click/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { recordClick } from '@/lib/attend/promotion/promotion-service'

export const runtime = 'nodejs'

// GET /api/attend/promotion/[id]/click?to=<event-slug> — records a click on the
// campaign, then redirects to that event. `to` is constrained to an event slug
// so the redirect target can only ever be an internal /attend/events path.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const to = req.nextUrl.searchParams.get('to') ?? ''
  const slug = /^[a-z0-9-]{1,200}$/.test(to) ? to : null

  await recordClick(params.id)

  const dest = slug ? `/attend/events/${slug}` : '/attend'
  return NextResponse.redirect(new URL(dest, req.nextUrl.origin))
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/attend/promotion/impressions/route.ts" "src/app/api/attend/promotion/[id]/click/route.ts"
git commit -m "feat(attend): add promotion tracking routes (Phase 6e task 5)"
```

---

### Task 6: Featured row on discovery

The discovery service gains a `featured` list; `DiscoveryClient` renders a Featured row at the top and fires the impression beacon once on mount.

**Files:**
- Modify: `src/lib/attend/discovery/discovery-service.ts`
- Modify: `src/app/attend/discovery-client.tsx`
- Modify: `src/app/attend/page.tsx`

- [ ] **Step 1: Add `featured` to the discovery service**

In `src/lib/attend/discovery/discovery-service.ts`: add the import and extend `DiscoveryFeed` + `getDiscoveryFeed`.

Add to the imports:

```ts
import { getFeaturedEvents, type FeaturedEvent } from '@/lib/attend/promotion/promotion-service'
```

Replace the `DiscoveryFeed` interface and `getDiscoveryFeed` with:

```ts
export interface DiscoveryFeed {
  featured: FeaturedEvent[]
  live: EventRow[]
  upcoming: EventRow[]
}

/** The discovery page: a featured row, plus events happening now and upcoming. */
export async function getDiscoveryFeed(): Promise<DiscoveryFeed> {
  const [events, featured] = await Promise.all([listDiscoverableEvents(), getFeaturedEvents()])
  const live: EventRow[] = []
  const upcoming: EventRow[] = []
  for (const ev of events) {
    if (eventTiming(ev.status) === 'LIVE') live.push(ev)
    else upcoming.push(ev)
  }
  return { featured, live, upcoming }
}
```

- [ ] **Step 2: Pass `featured` through the page**

Replace `src/app/attend/page.tsx` with:

```tsx
// /attend discovery — browse live and upcoming events (spec §7.1).
import { getDiscoveryFeed } from '@/lib/attend/discovery/discovery-service'
import DiscoveryClient from './discovery-client'

export const dynamic = 'force-dynamic'

export default async function AttendHome() {
  const { featured, live, upcoming } = await getDiscoveryFeed()
  return <DiscoveryClient featured={featured} live={live} upcoming={upcoming} />
}
```

- [ ] **Step 3: Render the Featured row in `DiscoveryClient`**

In `src/app/attend/discovery-client.tsx`, add `useEffect` to the React import, add a `FeaturedEvent` import, accept the `featured` prop, render a Featured section, and fire the beacon. Replace the file's contents with:

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { EventRow } from '@/lib/attend/events/repository'
import type { FeaturedEvent } from '@/lib/attend/promotion/promotion-service'

// Local UI label list — the codebase keeps these per-component (see
// creator-events-client.tsx, ticket-types-panel.tsx) rather than shared.
const SHOW_TYPES = [
  { value: 'HUMAN_LIVE_BROADCAST', label: 'Human live broadcast' },
  { value: 'FREE_EVENT', label: 'Free event' },
  { value: 'PRIVATE_EVENT', label: 'Private event' },
]
const showTypeLabel = (v: string) => SHOW_TYPES.find((t) => t.value === v)?.label ?? v

const fmtWhen = (iso: string | null) => (iso ? iso.slice(0, 16).replace('T', ' ') : 'Date TBA')

const filterPill = (active: boolean) =>
  'rounded-full px-3 py-1 text-xs font-bold tracking-wider transition ' +
  (active
    ? 'bg-[#E8C456] text-black'
    : 'border border-[#2a2135] text-[#9e8a55] hover:text-[#E8C456]')

export default function DiscoveryClient({
  featured,
  live,
  upcoming,
}: {
  featured: FeaturedEvent[]
  live: EventRow[]
  upcoming: EventRow[]
}) {
  const [filter, setFilter] = useState('ALL')

  // Fire one impression beacon per page view for the featured campaigns.
  useEffect(() => {
    if (featured.length === 0) return
    const campaignIds = featured.map((f) => f.campaignId)
    fetch('/api/attend/promotion/impressions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignIds }),
      keepalive: true,
    }).catch(() => {})
  }, [featured])

  const apply = (events: EventRow[]) =>
    filter === 'ALL' ? events : events.filter((e) => e.show_type === filter)

  return (
    <div className="py-10">
      <h1 className="text-3xl font-black md:text-4xl">Live events, browser-first.</h1>
      <p className="mt-2 text-sm text-[#9e8a55]">
        Discover live performances and join the show from any browser.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <button onClick={() => setFilter('ALL')} className={filterPill(filter === 'ALL')}>
          All
        </button>
        {SHOW_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setFilter(t.value)}
            className={filterPill(filter === t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {featured.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs font-black tracking-[0.2em] text-[#E8C456]">FEATURED</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((f) => (
              <Link
                key={f.campaignId}
                href={`/api/attend/promotion/${f.campaignId}/click?to=${f.event.slug}`}
                className="flex flex-col gap-2 rounded border border-[#E8C456] bg-[#15120c] p-4 transition hover:brightness-110"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#E8C456]">
                  Featured · {showTypeLabel(f.event.show_type)}
                </span>
                <span className="text-base font-black">
                  {f.headline ?? f.event.title}
                </span>
                <span className="font-mono text-[10px] tracking-widest text-[#9e8a55]">
                  {fmtWhen(f.event.starts_at)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <Section title="LIVE NOW" empty="No live events right now." events={apply(live)} live />
      <Section
        title="UPCOMING"
        empty="No upcoming events yet."
        events={apply(upcoming)}
        live={false}
      />
    </div>
  )
}

function Section({
  title,
  empty,
  events,
  live,
}: {
  title: string
  empty: string
  events: EventRow[]
  live: boolean
}) {
  return (
    <section className="mt-8">
      <h2 className="text-xs font-black tracking-[0.2em] text-[#9e8a55]">{title}</h2>
      {events.length === 0 ? (
        <p className="mt-3 text-sm text-[#9e8a55]">{empty}</p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((ev) => (
            <EventCard key={ev.id} ev={ev} live={live} />
          ))}
        </div>
      )}
    </section>
  )
}

function EventCard({ ev, live }: { ev: EventRow; live: boolean }) {
  return (
    <Link
      href={`/attend/events/${ev.slug}`}
      className="flex flex-col gap-2 rounded border border-[#2a2135] bg-[#111111] p-4 transition hover:border-[#E8C456]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#9e8a55]">
          {showTypeLabel(ev.show_type)}
        </span>
        {live ? (
          <span className="font-mono text-[10px] font-bold tracking-widest text-[#39FF14]">
            ● LIVE
          </span>
        ) : (
          <span className="font-mono text-[10px] tracking-widest text-[#9e8a55]">
            {fmtWhen(ev.starts_at)}
          </span>
        )}
      </div>
      <span className="text-base font-black">{ev.title}</span>
    </Link>
  )
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/attend/discovery/discovery-service.ts src/app/attend/page.tsx src/app/attend/discovery-client.tsx
git commit -m "feat(attend): add the featured row to discovery (Phase 6e task 6)"
```

---

### Task 7: Creator promotion dashboard

A page at `/attend/creator/events/[id]/promotion` — the editable creative plus the analytics — with a link added to the event dashboard.

**Files:**
- Create: `src/app/attend/(creator)/creator/events/[id]/promotion/page.tsx`
- Create: `src/app/attend/(creator)/creator/events/[id]/promotion/promotion-client.tsx`
- Modify: `src/app/attend/(creator)/creator/events/[id]/page.tsx`

- [ ] **Step 1: Write the promotion client**

Create `src/app/attend/(creator)/creator/events/[id]/promotion/promotion-client.tsx`:

```tsx
'use client'

import { useState } from 'react'
import type { PromotionDashboard } from '@/lib/attend/promotion/promotion-service'

const inputClass =
  'rounded border border-[#2a2135] bg-[#08070a] px-3 py-2 text-sm text-[#ede8d8] outline-none focus:border-[#E8C456]'

export default function PromotionClient({
  eventId,
  dashboard,
}: {
  eventId: string
  dashboard: PromotionDashboard
}) {
  const [headline, setHeadline] = useState(dashboard.headline)
  const [body, setBody] = useState(dashboard.body)
  const [approved, setApproved] = useState(dashboard.creativeApproved)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch(`/api/attend/creator/events/${eventId}/promotion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headline, body, approved }),
      })
      if (res.ok) {
        setSaved(true)
        return
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      setError(data.error ?? 'Could not save the creative')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      <section>
        <h2 className="text-xs font-black tracking-[0.2em] text-[#9e8a55]">AD CREATIVE</h2>
        <div className="mt-3 flex flex-col gap-2">
          <label className="text-xs text-[#9e8a55]">Headline</label>
          <input
            value={headline}
            onChange={(e) => {
              setHeadline(e.target.value)
              setSaved(false)
            }}
            className={inputClass}
          />
          <label className="mt-2 text-xs text-[#9e8a55]">Body</label>
          <textarea
            value={body}
            onChange={(e) => {
              setBody(e.target.value)
              setSaved(false)
            }}
            rows={3}
            className={inputClass}
          />
          <label className="mt-1 flex items-center gap-2 text-xs text-[#9e8a55]">
            <input
              type="checkbox"
              checked={approved}
              onChange={(e) => {
                setApproved(e.target.checked)
                setSaved(false)
              }}
            />
            Mark this creative as approved
          </label>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={busy}
              className="w-fit rounded bg-[#E8C456] px-4 py-1.5 text-xs font-bold text-black transition hover:brightness-110 disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save creative'}
            </button>
            {saved && <span className="text-xs text-green-400">Saved</span>}
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xs font-black tracking-[0.2em] text-[#9e8a55]">PERFORMANCE</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Impressions" value={dashboard.impressions.toLocaleString()} />
          <Stat label="Clicks" value={dashboard.clicks.toLocaleString()} />
          <Stat label="Tickets sold" value={dashboard.conversions.toLocaleString()} />
          <Stat label="Budget" value={`$${(dashboard.budgetCents / 100).toFixed(2)}`} />
        </div>
        <p className="mt-3 text-[11px] text-[#9e8a55]">
          Internal placements on HYVE run at no cost — your ${(dashboard.budgetCents / 100).toFixed(0)} budget is
          reserved for external ad campaigns as those integrations come online.
        </p>
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[#2a2135] bg-[#111111] px-3 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#9e8a55]">{label}</p>
      <p className="mt-1 text-lg font-black">{value}</p>
    </div>
  )
}
```

- [ ] **Step 2: Write the promotion page**

Create `src/app/attend/(creator)/creator/events/[id]/promotion/page.tsx`:

```tsx
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { requireCreator } from '@/lib/attend/identity/roles'
import { ForbiddenError, NotFoundError } from '@/lib/attend/events/service'
import { getPromotionDashboard } from '@/lib/attend/promotion/promotion-service'
import PromotionClient from './promotion-client'

export const metadata = { title: 'Promotion — HYVE Attend' }
export const dynamic = 'force-dynamic'

export default async function PromotionPage({ params }: { params: { id: string } }) {
  const profile = await requireCreator()
  if (!profile) redirect('/attend/login')
  try {
    const dashboard = await getPromotionDashboard(params.id, profile.id)
    return (
      <div className="py-10">
        <Link
          href={`/attend/creator/events/${params.id}`}
          className="text-xs font-bold text-[#9e8a55] hover:text-[#E8C456]"
        >
          ← Back to event
        </Link>
        <h1 className="mt-3 text-2xl font-black">Promotion</h1>
        <p className="mt-1 text-sm text-[#9e8a55]">
          Your event is featured across HYVE Attend. Tune the ad creative and
          track how it performs.
        </p>
        <PromotionClient eventId={params.id} dashboard={dashboard} />
      </div>
    )
  } catch (err) {
    if (err instanceof NotFoundError || err instanceof ForbiddenError) notFound()
    throw err
  }
}
```

- [ ] **Step 3: Write the creative-save route**

Create `src/app/api/attend/creator/events/[id]/promotion/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { requireCreator } from '@/lib/attend/identity/roles'
import { savePromotionCreative } from '@/lib/attend/promotion/promotion-service'
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/attend/events/service'

export const runtime = 'nodejs'

// POST /api/attend/creator/events/[id]/promotion — save the ad creative.
// Body: { headline: string, body: string, approved: boolean }.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const profile = await requireCreator()
  if (!profile) return NextResponse.json({ error: 'Please sign in' }, { status: 401 })

  let body: { headline?: unknown; body?: unknown; approved?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    await savePromotionCreative(params.id, profile.id, {
      headline: typeof body.headline === 'string' ? body.headline : '',
      body: typeof body.body === 'string' ? body.body : '',
      approved: body.approved === true,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 })
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    console.error('[attend promotion save]:', (err as Error).message)
    return NextResponse.json({ error: 'Could not save the creative' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Add the Promotion link to the event dashboard**

Replace `src/app/attend/(creator)/creator/events/[id]/page.tsx` with:

```tsx
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { requireCreator } from '@/lib/attend/identity/roles'
import { getCreatorEvent, ForbiddenError, NotFoundError } from '@/lib/attend/events/service'
import { listEventTicketTypes } from '@/lib/attend/ticketing/ticket-type-service'
import { payoutsEnabled } from '@/lib/attend/payments/connect-service'
import { getEventStream } from '@/lib/attend/streaming/streaming-service'
import EventDashboardClient from './event-dashboard-client'

export const metadata = { title: 'Event — HYVE Attend' }
export const dynamic = 'force-dynamic'

export default async function EventDashboardPage({ params }: { params: { id: string } }) {
  const profile = await requireCreator()
  if (!profile) redirect('/attend/login')
  try {
    const [event, ticketTypes, payouts, stream] = await Promise.all([
      getCreatorEvent(params.id, profile.id),
      listEventTicketTypes(params.id, profile.id),
      payoutsEnabled(profile.id),
      getEventStream(params.id),
    ])
    return (
      <>
        <div className="flex justify-end pt-6">
          <Link
            href={`/attend/creator/events/${params.id}/promotion`}
            className="text-xs font-bold text-[#9e8a55] transition hover:text-[#E8C456]"
          >
            Promotion →
          </Link>
        </div>
        <EventDashboardClient
          event={event}
          ticketTypes={ticketTypes}
          payoutsEnabled={payouts}
          stream={stream}
        />
      </>
    )
  } catch (err) {
    if (err instanceof NotFoundError || err instanceof ForbiddenError) notFound()
    throw err
  }
}
```

- [ ] **Step 5: Typecheck, build, and run the test suite**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds; the route list includes `/attend/creator/events/[id]/promotion`, `/api/attend/promotion/impressions`, `/api/attend/promotion/[id]/click`, and `/api/attend/creator/events/[id]/promotion`.

Run: `npx vitest run`
Expected: all tests pass, including `promotion-copy.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add "src/app/attend/(creator)/creator/events/[id]/promotion" "src/app/api/attend/creator/events/[id]/promotion/route.ts" "src/app/attend/(creator)/creator/events/[id]/page.tsx"
git commit -m "feat(attend): add the creator promotion dashboard (Phase 6e task 7)"
```

---

## Verification & acceptance

After all tasks, confirm:

- `npx tsc --noEmit`, `npx vitest run`, and `npm run build` all pass.
- Migration 031 is applied (the Task 2 probe).
- The §19 flow is reachable: a registered event has a campaign → its starter creative generates on first dashboard view → the creator edits/approves it → the event shows in the discovery Featured row → impressions and clicks accrue → the dashboard reports impressions / clicks / tickets-sold / budget.
- Isolation holds: `git diff main --stat` shows only new files plus the Attend-owned `discovery-service.ts`, `discovery-client.tsx`, `page.tsx` (discovery), and the event-dashboard `page.tsx`.

**Deferred to later phases (out of scope for 6e):**
- The other §19 internal placements — category pages, email digests, in-app notification slots, the share-card generator.
- External ad-network integration (Meta/TikTok/Google) and real budget drawdown — internal placements are free, so the $50 budget stays whole.
- Click-attributed conversions — "conversions" is the count of tickets sold for the event, not attributed to a featured click.
- Campaign pause/exhaust lifecycle beyond the `ACTIVE` default.
- Gating the Featured slot on `creative_approved` — per §19 internal promotion runs immediately with the starter creative, so `creative_approved` is the creator's "I've reviewed this" marker, not a prerequisite for featuring.
