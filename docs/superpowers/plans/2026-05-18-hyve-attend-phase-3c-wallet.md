# HYVE Attend — Phase 3c: Wallet + Cart Expiry Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax. Executed in-session against the `attend-phase-3c-wallet` branch. Completes the buyer flow.

**Goal:** A buyer can see the tickets they own at `/attend/wallet`, and abandoned unpaid orders release their held inventory automatically via a `cart-expiry` background job.

**Architecture:** A new `attend_expire_order` RPC atomically cancels a `PENDING` order, expires its held tickets, and restores `quantity_sold`. The `cart-expiry` job route finds stale `PENDING` orders and calls it per order. A `wallet` module composes a buyer's owned tickets (one PostgREST embed read) into per-event groups for the wallet page. Enabling cart-expiry also requires softening `attend_complete_checkout` so a late payment can never wedge the Stripe webhook.

**Tech Stack:** Next.js 14, TypeScript (strict), Tailwind, Vitest, plpgsql migrations. Migrations applied to Supabase via the MCP `apply_migration` tool (project ref `jlyqezwuyhfevrdomazd`).

---

## Context for the executor

Phases 1–3b are merged. Buyers can discover events, view an event page, and pay through Stripe Checkout — `attend_complete_checkout` issues `ASSIGNED_TO_BUYER` tickets owned by the buyer. **There is no wallet, and an abandoned `PENDING` order holds its inventory forever.**

**Schema (already migrated):**
- `attend_orders` — `id, buyer_id, event_id, status (PENDING/PAID/…/CANCELLED/…), …, stripe_checkout_session_id, created_at`.
- `attend_order_line_items` — `id, order_id, ticket_type_id, quantity, unit_price_cents`.
- `attend_tickets` — `id, order_id, event_id (not null FK), ticket_type_id (not null FK), owner_id (nullable), access_token, state (attend_ticket_state), created_at`. A paid ticket is `ASSIGNED_TO_BUYER` with `owner_id` = buyer; a held one is `HELD_IN_CART` with `owner_id` null.
- `attend_ticket_types` — `…, quantity_sold, …`.

**Decisions baked into this plan:**
- **Time-based expiry.** A Stripe Checkout session lives at most 24h; after that it cannot be paid. So a `PENDING` order older than **25h** (a 1h safety margin) is definitively abandoned — no per-order Stripe API call needed. This also reclaims orders left with a *null* `stripe_checkout_session_id` (the Phase 3b failure-window note).
- **Soften `attend_complete_checkout`.** Cart-expiry is the first code that sets an order `CANCELLED`. `attend_complete_checkout`'s `status <> 'PENDING'` branch currently `raise`s — a late `checkout.session.completed` would then wedge Stripe into ~3 days of 500 retries. Migration 020 re-defines it to return a no-op signal instead. (The 25h-vs-24h gap means the race cannot actually fire; this is defence in depth, as the Phase 3b review required.)
- **The wallet is read-only in 3c.** It lists owned tickets and their state. Transfer controls (Phase 4), the enter-show button (Phase 5), and refund status (Phase 6) are deferred — do not scaffold them.
- The job endpoint is gated by a bearer secret (`ATTEND_CRON_SECRET`) — a documented `.env.example` addition.

## File Structure

**Create:**
- `supabase/migrations/019_attend_expire_order.sql` — the RPC.
- `supabase/migrations/020_attend_complete_checkout_soft.sql` — re-defines `attend_complete_checkout` with the softened guard.
- `src/lib/attend/payments/cart-expiry-service.ts` — `expireStaleCarts()`.
- `src/app/api/attend/jobs/cart-expiry/route.ts` — the job endpoint.
- `src/lib/attend/ticketing/ticket-repository.ts` — `listOwnedTicketsWithContext()`.
- `src/lib/attend/wallet/wallet-grouping.ts` — pure `groupOwnedTickets()`.
- `src/lib/attend/wallet/wallet-grouping.test.ts` — its tests.
- `src/lib/attend/wallet/wallet-service.ts` — `getWallet()`.
- `src/app/attend/(attendee)/wallet/page.tsx` — the wallet page (server component).

**Modify:**
- `src/lib/attend/payments/checkout-service.ts` — `fulfilCheckout` logs a paid-after-cancel order.
- `.env.example` — document `ATTEND_CRON_SECRET`.

---

## Task 1: The expiry RPCs

**Files:**
- Create: `supabase/migrations/019_attend_expire_order.sql`, `supabase/migrations/020_attend_complete_checkout_soft.sql`

- [ ] **Step 1: Write migration 019 — `attend_expire_order`.** Atomic + idempotent: a still-`PENDING` order is cancelled, its `HELD_IN_CART` tickets `EXPIRED`, and the held `quantity_sold` restored from the line items.

```sql
-- HYVE Attend — attend_expire_order RPC. Atomically reclaims an abandoned
-- PENDING order: order -> CANCELLED, its HELD_IN_CART tickets -> EXPIRED, and
-- the held quantity_sold restored. Idempotent: a non-PENDING order is a no-op,
-- so the cart-expiry job is safe to run repeatedly and races a payment safely.
create or replace function attend_expire_order(p_args jsonb)
returns jsonb language plpgsql as $$
declare
  v_order_id uuid := (p_args->>'order_id')::uuid;
  v_order    attend_orders%rowtype;
  v_li       record;
begin
  select * into v_order from attend_orders where id = v_order_id for update;
  if v_order.id is null then
    raise exception 'attend_expire_order: order % not found', v_order_id;
  end if;

  if v_order.status <> 'PENDING' then
    return jsonb_build_object('order_id', v_order_id, 'status', v_order.status, 'expired', false);
  end if;

  update attend_orders set status = 'CANCELLED', updated_at = now() where id = v_order_id;

  update attend_tickets
     set state = 'EXPIRED', updated_at = now()
   where order_id = v_order_id and state = 'HELD_IN_CART';

  for v_li in
    select ticket_type_id, quantity from attend_order_line_items where order_id = v_order_id
  loop
    update attend_ticket_types
       set quantity_sold = greatest(0, quantity_sold - v_li.quantity), updated_at = now()
     where id = v_li.ticket_type_id;
  end loop;

  return jsonb_build_object('order_id', v_order_id, 'status', 'CANCELLED', 'expired', true);
end $$;
```

- [ ] **Step 2: Write migration 020 — soften `attend_complete_checkout`.** This is the *entire* migration-018 body with **only** the `status <> 'PENDING'` branch changed from `raise` to a no-op return. Copy `supabase/migrations/018_attend_complete_checkout.sql` verbatim and replace just that branch with:

```sql
  -- Neither PENDING nor PAID — e.g. CANCELLED by cart-expiry while a slow
  -- payment was in flight. Do NOT raise: that would wedge the Stripe webhook
  -- into days of 500 retries. Return a no-op signal — the buyer paid a
  -- cancelled order and is owed a refund (Phase 6 refund flow).
  if v_order.status <> 'PENDING' then
    return jsonb_build_object(
      'order_id', v_order_id, 'status', v_order.status, 'completed', false
    );
  end if;
```

(Give the file a header comment noting it re-defines the function to soften the guard for Phase 3c cart-expiry.)

- [ ] **Step 3: Apply both migrations** to Supabase via the MCP `apply_migration` tool (project ref `jlyqezwuyhfevrdomazd`), names `attend_expire_order` and `attend_complete_checkout_soft`. Confirm each returns success.
- [ ] **Step 4: Commit** — `feat(attend): add attend_expire_order + soften attend_complete_checkout (Phase 3c task 1)`.

---

## Task 2: The cart-expiry job

**Files:**
- Create: `src/lib/attend/payments/cart-expiry-service.ts`, `src/app/api/attend/jobs/cart-expiry/route.ts`
- Modify: `src/lib/attend/payments/checkout-service.ts`, `.env.example`

- [ ] **Step 1: `cart-expiry-service.ts`.** Export `expireStaleCarts(): Promise<{ scanned: number; expired: number }>`:
  - `const CART_HOLD_HOURS = 25` (1h past the 24h Stripe Checkout session max).
  - Compute the cutoff: `new Date(Date.now() - CART_HOLD_HOURS * 3600_000).toISOString()`.
  - `supaGet('attend_orders', `status=eq.PENDING&created_at=lt.${cutoff}&select=id`)` → the stale order ids.
  - For each, `supaPost('rpc/attend_expire_order', { p_args: { order_id } })`; count successes where the returned jsonb has `expired === true`. A non-OK RPC response is logged (`console.error`) and skipped — one bad order must not abort the run (the job is idempotent and will retry it next tick).
  - Return `{ scanned, expired }`.

- [ ] **Step 2: `cart-expiry/route.ts`** — the job endpoint. `export const runtime = 'nodejs'`, `export const dynamic = 'force-dynamic'`. `GET(req)`:
  - If `process.env.ATTEND_CRON_SECRET` is unset → `500 { error: 'Cron not configured' }` (fail closed, like the webhook).
  - Require `req.headers.get('authorization') === `Bearer ${process.env.ATTEND_CRON_SECRET}``; else `401`.
  - `await expireStaleCarts()` → `200` with the summary. On a thrown error, log + `500`.

- [ ] **Step 3: Soften `fulfilCheckout`** in `checkout-service.ts`. After the `attend_complete_checkout` RPC call, parse the returned jsonb; if `completed === false`, `console.error` that the order was already non-pending at payment and a refund is needed. (Do not throw — the webhook must still 2xx so Stripe stops retrying.)

```ts
  if (!res.ok) {
    throw new Error(`attend_complete_checkout RPC failed: ${res.status} ${await res.text()}`)
  }
  const result = (await res.json().catch(() => ({}))) as { status?: string; completed?: boolean }
  if (result.completed === false) {
    console.error(
      `[attend checkout] order ${orderId} was ${result.status} at payment — ` +
        'buyer paid a non-pending order; a refund is owed',
    )
  }
```

- [ ] **Step 4: `.env.example`** — add `ATTEND_CRON_SECRET` with a one-line comment ("Bearer token the GitHub Actions cron sends to /api/attend/jobs/*").

- [ ] **Step 5: Verify** — `npx tsc --noEmit`; `npm run build` lists `/api/attend/jobs/cart-expiry`.
- [ ] **Step 6: Commit** — `feat(attend): add the cart-expiry job (Phase 3c task 2)`.

---

## Task 3: Wallet data layer

**Files:**
- Create: `src/lib/attend/ticketing/ticket-repository.ts`, `src/lib/attend/wallet/wallet-grouping.ts`, `src/lib/attend/wallet/wallet-grouping.test.ts`, `src/lib/attend/wallet/wallet-service.ts`

- [ ] **Step 1: `ticket-repository.ts`.** Raw-REST reads for `attend_tickets`, query-only. Define `OwnedTicket` (the embed result shape) and `listOwnedTicketsWithContext(ownerId)`:

```ts
import { supaGet } from '@/lib/supabase'

export interface OwnedTicket {
  id: string
  state: string
  access_token: string
  created_at: string
  attend_events: {
    id: string
    title: string
    slug: string
    starts_at: string | null
    status: string
  }
  attend_ticket_types: { name: string; kind: string }
}

/** A buyer's owned tickets with their event + tier embedded (PostgREST joins
 *  on the attend_tickets FKs to attend_events / attend_ticket_types). */
export async function listOwnedTicketsWithContext(ownerId: string): Promise<OwnedTicket[]> {
  const res = await supaGet(
    'attend_tickets',
    `owner_id=eq.${ownerId}` +
      `&select=id,state,access_token,created_at,` +
      `attend_events(id,title,slug,starts_at,status),` +
      `attend_ticket_types(name,kind)` +
      `&order=created_at.desc`,
  )
  if (!res.ok) throw new Error(`attend_tickets query failed: ${res.status}`)
  return (await res.json()) as OwnedTicket[]
}
```

- [ ] **Step 2: Write the failing test** — `wallet-grouping.test.ts`. Build `OwnedTicket` fixtures across two events; assert `groupOwnedTickets` returns one group per event, each group carrying the event and its tickets, and that an empty input yields `[]`. Group order: by the event's earliest `created_at` ticket, or simply first-seen.

- [ ] **Step 3: Run, expect FAIL.**

- [ ] **Step 4: `wallet-grouping.ts`** — pure. `import type { OwnedTicket }` (type-only, so the test pulls no I/O):

```ts
import type { OwnedTicket } from '@/lib/attend/ticketing/ticket-repository'

export interface WalletEventGroup {
  event: OwnedTicket['attend_events']
  tickets: OwnedTicket[]
}

/** Group a buyer's owned tickets by their event, preserving input order. */
export function groupOwnedTickets(tickets: OwnedTicket[]): WalletEventGroup[] {
  const groups: WalletEventGroup[] = []
  const byEventId = new Map<string, WalletEventGroup>()
  for (const t of tickets) {
    let g = byEventId.get(t.attend_events.id)
    if (!g) {
      g = { event: t.attend_events, tickets: [] }
      byEventId.set(t.attend_events.id, g)
      groups.push(g)
    }
    g.tickets.push(t)
  }
  return groups
}
```

- [ ] **Step 5: Run, expect PASS.**

- [ ] **Step 6: `wallet-service.ts`** — `getWallet(ownerId): Promise<WalletEventGroup[]>` = `groupOwnedTickets(await listOwnedTicketsWithContext(ownerId))`.

- [ ] **Step 7: Verify** — `npx tsc --noEmit`; `npm test` green.
- [ ] **Step 8: Commit** — `feat(attend): add the wallet data layer (Phase 3c task 3)`.

---

## Task 4: The wallet page

**Files:**
- Create: `src/app/attend/(attendee)/wallet/page.tsx`

- [ ] **Step 1: Build the page** — a server component. `export const dynamic = 'force-dynamic'`. `requireAttendUser()`; if null, `redirect('/attend/login')`. `const groups = await getWallet(user.id)`. Render:
  - A heading ("Your tickets").
  - If `groups` is empty: an empty state ("No tickets yet — browse events") linking to `/attend`.
  - Otherwise, per `WalletEventGroup`: an event card — the event title as a `next/link` to `/attend/events/${event.slug}`, the wall-clock `starts_at` (`slice(0,16).replace('T',' ')`, or "Date TBA"), and the event status. Beneath it, one row per ticket: the tier name (`attend_ticket_types.name`) and a humanized ticket `state` (e.g. `ASSIGNED_TO_BUYER` → "Ready"; reuse a small `humanize` like the event page, or a tiny state-label map). If several tickets share a tier+state, listing them individually is fine for the MVP.
  - Reuse the dark palette and the `card` style from the event page / dashboard.

- [ ] **Step 2: Verify** — `npx tsc --noEmit`; `npm test` green; `npm run build` succeeds and lists `/attend/wallet`; no existing route changed.
- [ ] **Step 3: Commit** — `feat(attend): add the wallet page (Phase 3c task 4)`.

---

## Verification checklist (whole phase)

- [ ] `npx tsc --noEmit` clean; `npm test` green (incl. new `groupOwnedTickets` tests); `npm run build` succeeds, lists `/attend/wallet` and `/api/attend/jobs/cart-expiry`.
- [ ] Migrations 019 + 020 applied to Supabase.
- [ ] `attend_expire_order` is idempotent (non-`PENDING` → no-op) and restores `quantity_sold`.
- [ ] `attend_complete_checkout` no longer raises on a non-`PENDING` order — the Stripe webhook cannot wedge.
- [ ] The cart-expiry job endpoint is bearer-secret gated and fails closed when unconfigured.
- [ ] The wallet only ever shows the signed-in buyer's own tickets (`owner_id` filter).
- [ ] The only shared-file edit is `.env.example`; no new dependencies.

## Notes & deferrals

- **Buyer flow is complete after 3c.** Phase 4 (transfers) adds the per-ticket transfer/claim controls the wallet will host; Phase 5 (streaming) adds the enter-show button; Phase 6 adds refund status. None are scaffolded here.
- **Job scheduling** — the GitHub Actions workflow that calls `/api/attend/jobs/cart-expiry` on a schedule is operational config, not application code; it is set up alongside the other Attend jobs in Phase 6/7. The endpoint is built and secured here so it is ready.
- A paid-after-cancel order currently only logs (`fulfilCheckout`); the automatic refund is Phase 6. The 25h-vs-24h margin means this path is practically unreachable.
