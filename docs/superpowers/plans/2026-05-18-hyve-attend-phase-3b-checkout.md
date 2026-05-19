# HYVE Attend — Phase 3b: Checkout + Fulfilment Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax. Executed in-session against the `attend-phase-3b-checkout` branch. This is the money-critical phase — the two RPC bodies and the webhook are the correctness surface; review them carefully.

**Goal:** A signed-in buyer can select ticket quantities on an event page, see an itemized total, pay through Stripe Checkout, and have their tickets atomically issued when payment confirms.

**Architecture:** Two atomic Postgres RPCs do every money-critical multi-table write. `attend_create_pending_order` checks + holds inventory and creates a `PENDING` order with `HELD_IN_CART` tickets; `attend_complete_checkout` (called from the Stripe webhook) flips the order to `PAID`, hands tickets to the buyer, and posts the ledger. A `checkout-service` composes the fee calculator, the RPCs, and Stripe Checkout. The webhook reuses the Phase 2b exactly-once claim machinery.

**Tech Stack:** Next.js 14, TypeScript (strict), Tailwind, Vitest, plpgsql migrations, Stripe Checkout (`mode: 'payment'`). Migrations applied to Supabase via the MCP `apply_migration` tool (project ref `jlyqezwuyhfevrdomazd`).

---

## Context for the executor

Phases 1–3a are merged. Buyers can discover events (`/attend`) and view an event page (`/attend/events/[slug]`) showing ticket tiers — but there is **no buy path**.

**Schema (already migrated — do not re-create):**
- `attend_orders` — `id, buyer_id, event_id, status (attend_order_status: PENDING/PAID/PARTIALLY_REFUNDED/REFUNDED/CANCELLED/DISPUTED), subtotal_cents, hyve_fee_cents, processor_fee_cents, tax_cents, total_cents, currency, fee_mode (ABSORB/PASS_TO_BUYER), policy_snapshot jsonb, stripe_checkout_session_id, stripe_payment_intent_id`.
- `attend_order_line_items` — `id, order_id, ticket_type_id, quantity, unit_price_cents`.
- `attend_tickets` — `id, order_id, event_id, ticket_type_id, owner_id (nullable), access_token (not null unique), state (attend_ticket_state), checked_in_at`.
- `attend_ticket_types` — `…, price_cents, quantity_total, quantity_sold, max_per_order, status (ACTIVE/PAUSED/SOLD_OUT/HIDDEN)`.
- `attend_payments` — `id, kind (attend_payment_kind: TICKET_PURCHASE/REGISTRATION_FEE/REFUND), order_id, event_id, profile_id, amount_cents, currency, status, stripe_payment_intent_id, stripe_charge_id, stripe_refund_id, stripe_checkout_session_id`.
- `attend_ledger_entries` — `id, event_id, order_id, payment_id, ticket_id, type (attend_ledger_entry_type), amount_cents bigint signed, currency, description, source (SYSTEM/HUMAN), created_by`. Append-only.
- RPC stubs `attend_create_pending_order(p_args jsonb)` and `attend_complete_checkout(p_args jsonb)` exist in migration 014 and currently `raise exception '… not implemented'`.

**Reference pattern — `attend_pay_registration` (migration 015):** declare vars from `p_args->>`, `select … for update` to lock, idempotency early-return, `update`, `insert … on conflict do nothing`, insert ledger entries, `return jsonb_build_object(...)`. Phase 3b's RPCs follow the same shape.

**Existing pieces to reuse:**
- `payments/fee-calculator.ts` — `calculateFees(FeeInput): FeeBreakdown` (pure, tested).
- `payments/stripe.ts` — `attendStripe()`.
- `payments/registration-service.ts` — `startRegistrationCheckout`/`fulfilRegistration` are the structural template for `checkout-service.ts`.
- `payments/payments-repository.ts` — `insertPayment`, `findPaymentBySession`.
- `webhooks/stripe/route.ts` — already handles `checkout.session.completed` for `attend_kind === 'registration'` with exactly-once claim semantics.
- `identity/auth.ts` — `getAttendUser`, `ensureProfile`.

**Decisions baked into this plan:**
- **fee_mode is `ABSORB`** for all MVP orders (no UI sets `PASS_TO_BUYER`). Under ABSORB with 0 tax, `buyerTotal == subtotal`, so the Stripe line items (one per tier selection) sum to the order total. The RPC still derives `ARTIST_NET_PENDING` with a `fee_mode` branch so it is correct if `PASS_TO_BUYER` ever appears.
- **Tax is 0** (spec §13) — `taxEstimateCents: 0` into the calculator; `tax_cents` stored as 0.
- **Server is the source of truth for money.** The browser sends only `{ ticketTypeId, quantity }[]`. The server re-reads ticket-type prices, validates, and computes every cent. Client-side totals are display-only.
- **Inventory is held at order creation.** `attend_create_pending_order` increments `quantity_sold`; the Phase 3c `cart-expiry` job decrements it for unpaid expired orders. (Cart expiry itself is Phase 3c — not built here.)
- The first buyer **write** path. Checkout requires a signed-in user (any role); it must **not** promote them to `CREATOR`, so `requireCreator` cannot be reused — Task 1 adds `requireAttendUser`.

## File Structure

**Create:**
- `supabase/migrations/017_attend_create_pending_order.sql` — the RPC body.
- `supabase/migrations/018_attend_complete_checkout.sql` — the RPC body.
- `src/lib/attend/payments/checkout-pricing.ts` — pure `priceSelections()` (validate + price the cart).
- `src/lib/attend/payments/checkout-pricing.test.ts` — its tests.
- `src/lib/attend/payments/checkout-service.ts` — `startCheckout()`, `fulfilCheckout()`.
- `src/app/api/attend/events/[id]/checkout/route.ts` — `POST` the checkout.
- `src/app/attend/events/[slug]/checkout-client.tsx` — the ticket-picker UI.

**Modify:**
- `src/lib/attend/identity/roles.ts` — add `requireAttendUser()`.
- `src/app/api/attend/webhooks/stripe/route.ts` — route `attend_kind === 'ticket_order'` to `fulfilCheckout`.
- `src/app/attend/events/[slug]/page.tsx` — render `<CheckoutClient>`; pass `signedIn`.

---

## Task 1: Checkout prerequisites — auth helper + cart pricing

**Files:**
- Modify: `src/lib/attend/identity/roles.ts`
- Create: `src/lib/attend/payments/checkout-pricing.ts`, `src/lib/attend/payments/checkout-pricing.test.ts`

- [ ] **Step 1: Add `requireAttendUser` to `roles.ts`.** Resolves the signed-in user and ensures a profile, **without** the `CREATOR` promotion `requireCreator` does:

```ts
/** The current Attend user with a provisioned profile, or null. Unlike
 *  requireCreator this does not promote the user — buyers stay role USER. */
export async function requireAttendUser(): Promise<AttendUser | null> {
  const user = await getAttendUser()
  if (!user) return null
  await ensureProfile(user) // profile id === user.id (attend_profiles.id == auth.users.id)
  return user
}
```

`roles.ts` already imports `getAttendUser` and `ensureProfile` from `auth.ts`, but **not** the `AttendUser` type — add `AttendUser` to that existing import line. `AttendUser` is `{ id, email }`; `requireAttendUser` returns it (and `user.id` is the buyer's profile id).

- [ ] **Step 2: Write the failing test** — `checkout-pricing.test.ts`. Build minimal `TicketTypeRow` fixtures (only the fields `priceSelections` reads matter). Cover: a valid multi-tier selection sums correctly; zero-quantity rows are dropped; an empty/all-zero selection throws; quantity above `max_per_order` throws; an unknown `ticketTypeId` throws; a non-`ACTIVE` tier throws; a non-integer/negative quantity throws.

- [ ] **Step 3: Run, expect FAIL.**

- [ ] **Step 4: Write `checkout-pricing.ts`** — pure, no I/O. Throws `ValidationError` (imported from `@/lib/attend/events/service`, the shared error class — maps to HTTP 400). It does **not** check inventory (`quantity_sold`) — that needs a row lock and is the RPC's job.

```ts
import type { TicketTypeRow } from '@/lib/attend/ticketing/ticket-type-repository'
import { ValidationError } from '@/lib/attend/events/service'

export interface Selection { ticketTypeId: string; quantity: number }
export interface PricedItem {
  ticketTypeId: string
  name: string
  quantity: number
  unitPriceCents: number
}
export interface PricedSelections { items: PricedItem[]; subtotalCents: number }

/** Validate a buyer's ticket selection against the event's tiers and price it.
 *  Pure — inventory availability is enforced later, under lock, by the RPC. */
export function priceSelections(
  selections: Selection[],
  ticketTypes: TicketTypeRow[],
): PricedSelections {
  const chosen = selections.filter((s) => s.quantity > 0)
  if (chosen.length === 0) throw new ValidationError('Select at least one ticket')

  const items: PricedItem[] = []
  let subtotalCents = 0
  for (const sel of chosen) {
    if (!Number.isInteger(sel.quantity) || sel.quantity < 1) {
      throw new ValidationError('Ticket quantity must be a positive whole number')
    }
    const tt = ticketTypes.find((t) => t.id === sel.ticketTypeId)
    if (!tt) throw new ValidationError('Unknown ticket type')
    if (tt.status !== 'ACTIVE') throw new ValidationError(`${tt.name} is not on sale`)
    if (sel.quantity > tt.max_per_order) {
      throw new ValidationError(`At most ${tt.max_per_order} of "${tt.name}" per order`)
    }
    items.push({
      ticketTypeId: tt.id,
      name: tt.name,
      quantity: sel.quantity,
      unitPriceCents: tt.price_cents,
    })
    subtotalCents += sel.quantity * tt.price_cents
  }
  return { items, subtotalCents }
}
```

- [ ] **Step 5: Run, expect PASS** — `npm test`.
- [ ] **Step 6: Verify** — `npx tsc --noEmit`.
- [ ] **Step 7: Commit** — `feat(attend): add the checkout auth helper + cart pricing (Phase 3b task 1)`.

---

## Task 2: `attend_create_pending_order` RPC

**Files:**
- Create: `supabase/migrations/017_attend_create_pending_order.sql`

- [ ] **Step 1: Write the migration.** Replaces the migration-014 stub. Atomic: validate the event is `ON_SALE`, then per selected tier lock the row, check inventory, hold it, and insert the order + line items + one `HELD_IN_CART` ticket per seat. Any `raise` rolls the whole function back.

```sql
-- HYVE Attend — attend_create_pending_order RPC body (replaces the Phase 1
-- stub). Atomically holds inventory and creates a PENDING order with one
-- HELD_IN_CART ticket per seat. A Stripe Checkout session is opened next;
-- the cart-expiry job (Phase 3c) reclaims the hold if it is never paid.
create or replace function attend_create_pending_order(p_args jsonb)
returns jsonb language plpgsql as $$
declare
  v_buyer_id uuid := (p_args->>'buyer_id')::uuid;
  v_event_id uuid := (p_args->>'event_id')::uuid;
  v_currency text := coalesce(p_args->>'currency', 'usd');
  v_fee_mode text := coalesce(p_args->>'fee_mode', 'ABSORB');
  v_event    attend_events%rowtype;
  v_order_id uuid;
  v_item     jsonb;
  v_tt       attend_ticket_types%rowtype;
  v_qty      int;
  i          int;
begin
  select * into v_event from attend_events where id = v_event_id for update;
  if v_event.id is null then
    raise exception 'attend_create_pending_order: event % not found', v_event_id;
  end if;
  if v_event.status <> 'ON_SALE' then
    raise exception 'attend_create_pending_order: event % is not on sale (%)',
      v_event_id, v_event.status;
  end if;

  insert into attend_orders (
    buyer_id, event_id, status, subtotal_cents, hyve_fee_cents, processor_fee_cents,
    tax_cents, total_cents, currency, fee_mode, policy_snapshot
  ) values (
    v_buyer_id, v_event_id, 'PENDING',
    (p_args->>'subtotal_cents')::int, (p_args->>'hyve_fee_cents')::int,
    (p_args->>'processor_fee_cents')::int, (p_args->>'tax_cents')::int,
    (p_args->>'total_cents')::int, v_currency, v_fee_mode,
    jsonb_build_object(
      'policy_text', v_event.policy_text,
      'refund_cutoff_hours', v_event.refund_cutoff_hours,
      'transfer_cutoff_hours', v_event.transfer_cutoff_hours
    )
  ) returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_args->'items') loop
    v_qty := (v_item->>'quantity')::int;
    if v_qty < 1 then
      raise exception 'attend_create_pending_order: quantity must be >= 1';
    end if;

    select * into v_tt from attend_ticket_types
      where id = (v_item->>'ticket_type_id')::uuid for update;
    if v_tt.id is null or v_tt.event_id <> v_event_id then
      raise exception 'attend_create_pending_order: ticket type % not on event %',
        v_item->>'ticket_type_id', v_event_id;
    end if;
    if v_tt.status <> 'ACTIVE' then
      raise exception 'attend_create_pending_order: ticket type % is not on sale', v_tt.id;
    end if;
    if v_qty > v_tt.max_per_order then
      raise exception 'attend_create_pending_order: quantity % exceeds max % per order',
        v_qty, v_tt.max_per_order;
    end if;
    if v_tt.quantity_sold + v_qty > v_tt.quantity_total then
      raise exception 'attend_create_pending_order: not enough tickets left for "%"', v_tt.name;
    end if;

    update attend_ticket_types
       set quantity_sold = quantity_sold + v_qty, updated_at = now()
     where id = v_tt.id;

    insert into attend_order_line_items (order_id, ticket_type_id, quantity, unit_price_cents)
    values (v_order_id, v_tt.id, v_qty, v_tt.price_cents);

    for i in 1..v_qty loop
      insert into attend_tickets
        (order_id, event_id, ticket_type_id, owner_id, access_token, state)
      values
        (v_order_id, v_event_id, v_tt.id, null, gen_random_uuid()::text, 'HELD_IN_CART');
    end loop;
  end loop;

  return jsonb_build_object('order_id', v_order_id, 'status', 'PENDING');
end $$;
```

- [ ] **Step 2: Apply the migration** to Supabase via the MCP `apply_migration` tool (project ref `jlyqezwuyhfevrdomazd`), name `attend_create_pending_order`. Confirm success.
- [ ] **Step 3: Commit** — `feat(attend): implement the attend_create_pending_order RPC (Phase 3b task 2)`.

---

## Task 3: `attend_complete_checkout` RPC

**Files:**
- Create: `supabase/migrations/018_attend_complete_checkout.sql`

- [ ] **Step 1: Write the migration.** Replaces the migration-014 stub. Atomic + idempotent: lock the order; if already `PAID` return a no-op; flip `PENDING → PAID`, hand the held tickets to the buyer, and post the five ledger entries.

```sql
-- HYVE Attend — attend_complete_checkout RPC body (replaces the Phase 1
-- stub). Atomically completes a paid checkout: order PENDING -> PAID, its
-- HELD_IN_CART tickets -> ASSIGNED_TO_BUYER, and the ledger is posted.
-- Idempotent — a retried checkout.session.completed webhook is a safe no-op.
create or replace function attend_complete_checkout(p_args jsonb)
returns jsonb language plpgsql as $$
declare
  v_order_id   uuid := (p_args->>'order_id')::uuid;
  v_payment_id uuid := nullif(p_args->>'payment_id', '')::uuid;
  v_pi         text := nullif(p_args->>'stripe_payment_intent_id', '');
  v_order      attend_orders%rowtype;
  v_artist_net bigint;
begin
  select * into v_order from attend_orders where id = v_order_id for update;
  if v_order.id is null then
    raise exception 'attend_complete_checkout: order % not found', v_order_id;
  end if;

  if v_order.status = 'PAID' then
    return jsonb_build_object('order_id', v_order_id, 'status', 'PAID', 'already_done', true);
  end if;
  if v_order.status <> 'PENDING' then
    raise exception 'attend_complete_checkout: order % is %, not PENDING',
      v_order_id, v_order.status;
  end if;

  update attend_orders
     set status = 'PAID',
         stripe_payment_intent_id = coalesce(v_pi, stripe_payment_intent_id),
         updated_at = now()
   where id = v_order_id;

  update attend_tickets
     set state = 'ASSIGNED_TO_BUYER', owner_id = v_order.buyer_id, updated_at = now()
   where order_id = v_order_id and state = 'HELD_IN_CART';

  -- ARTIST_NET_PENDING: under ABSORB the artist absorbs the fees; under
  -- PASS_TO_BUYER the fees were added on top, so the artist nets the subtotal.
  v_artist_net := case
    when v_order.fee_mode = 'PASS_TO_BUYER' then v_order.subtotal_cents
    else v_order.subtotal_cents - v_order.hyve_fee_cents - v_order.processor_fee_cents
  end;

  insert into attend_ledger_entries
    (event_id, order_id, payment_id, type, amount_cents, currency, description, source)
  values
    (v_order.event_id, v_order_id, v_payment_id, 'TICKET_GROSS',
     v_order.subtotal_cents, v_order.currency, 'Ticket sales gross', 'SYSTEM'),
    (v_order.event_id, v_order_id, v_payment_id, 'HYVE_PLATFORM_FEE',
     v_order.hyve_fee_cents, v_order.currency, 'HYVE platform fee', 'SYSTEM'),
    (v_order.event_id, v_order_id, v_payment_id, 'PROCESSOR_FEE_ESTIMATE',
     v_order.processor_fee_cents, v_order.currency, 'Payment processor fee (estimate)', 'SYSTEM'),
    (v_order.event_id, v_order_id, v_payment_id, 'TAX_COLLECTED',
     v_order.tax_cents, v_order.currency, 'Tax collected', 'SYSTEM'),
    (v_order.event_id, v_order_id, v_payment_id, 'ARTIST_NET_PENDING',
     v_artist_net, v_order.currency, 'Artist net, pending payout', 'SYSTEM');

  return jsonb_build_object('order_id', v_order_id, 'status', 'PAID');
end $$;
```

- [ ] **Step 2: Apply the migration** via the MCP `apply_migration` tool, name `attend_complete_checkout`. Confirm success.
- [ ] **Step 3: Commit** — `feat(attend): implement the attend_complete_checkout RPC (Phase 3b task 3)`.

---

## Task 4: Checkout service

**Files:**
- Create: `src/lib/attend/payments/checkout-service.ts`

- [ ] **Step 1: Build `startCheckout`.** Signature: `startCheckout(buyerId: string, eventId: string, selections: Selection[], origin: string): Promise<{ url: string }>`. Steps:
  1. `getEventById(eventId)` — throw `NotFoundError` if missing; throw `ValidationError` if `status !== 'ON_SALE'`.
  2. `listTicketTypesByEvent(eventId)` (repository fn) → `priceSelections(selections, ticketTypes)` → `{ items, subtotalCents }`.
  3. `calculateFees({ showType: event.show_type, ticketSubtotalCents: subtotalCents, quantity: <total seats>, feeMode: 'ABSORB', taxEstimateCents: 0, discountsCents: 0, currency: 'usd' })` → breakdown.
  4. `attend_create_pending_order` via `supaPost('rpc/attend_create_pending_order', { p_args: { buyer_id, event_id, items: items.map(i => ({ ticket_type_id, quantity })), subtotal_cents, hyve_fee_cents, processor_fee_cents, tax_cents, total_cents: breakdown.buyerTotalCents, currency, fee_mode: 'ABSORB' } })`. On non-OK, throw with the response body. Read `order_id` from the returned jsonb.
  5. Create the Stripe Checkout session — `mode: 'payment'`, one `line_items` entry per priced item (`price_data: { currency: 'usd', unit_amount: unitPriceCents, product_data: { name } }, quantity`), `metadata: { attend_kind: 'ticket_order', attend_order_id: order_id, attend_event_id: eventId, attend_buyer_id: buyerId }`, `success_url: ${origin}/attend/events/${event.slug}?purchased=1`, `cancel_url: ${origin}/attend/events/${event.slug}?cancelled=1`.
  6. `supaPatch('attend_orders', `id=eq.${order_id}`, { stripe_checkout_session_id: session.id })` so the Phase 3c cart-expiry job can find the session.
  7. Return `{ url: session.url }` (throw if Stripe returned no URL).

- [ ] **Step 2: Build `fulfilCheckout`.** Signature: `fulfilCheckout(session: Stripe.Checkout.Session): Promise<void>` — the structural twin of `fulfilRegistration`. Steps:
  1. Read `attend_order_id`, `attend_event_id`, `attend_buyer_id` from `session.metadata` — throw if any missing.
  2. `paymentIntentId` from `session.payment_intent` (string or `.id` or null).
  3. Idempotent payment record: `findPaymentBySession(session.id)`; if absent, `insertPayment({ kind: 'TICKET_PURCHASE', order_id, event_id, profile_id: buyerId, amount_cents: session.amount_total ?? 0, currency: session.currency ?? 'usd', status: 'SUCCEEDED', stripe_payment_intent_id: paymentIntentId, stripe_charge_id: null, stripe_refund_id: null, stripe_checkout_session_id: session.id })`.
  4. `supaPost('rpc/attend_complete_checkout', { p_args: { order_id, payment_id: payment.id, stripe_payment_intent_id: paymentIntentId } })`; on non-OK throw with the response body (the webhook then releases its claim and Stripe retries the idempotent RPC).

  Imports: `attendStripe` + `Stripe` type, `calculateFees`, `priceSelections` + `Selection`, `getEventById` from `events/repository`, `listTicketTypesByEvent` from `ticketing/ticket-type-repository`, `insertPayment`/`findPaymentBySession` from `payments-repository`, `NotFoundError`/`ValidationError` from `events/service`, `supaPost`/`supaPatch` from `@/lib/supabase`.

- [ ] **Step 3: Verify** — `npx tsc --noEmit`.
- [ ] **Step 4: Commit** — `feat(attend): add the checkout service (Phase 3b task 4)`.

---

## Task 5: Checkout API route

**Files:**
- Create: `src/app/api/attend/events/[id]/checkout/route.ts`

- [ ] **Step 1: Build the route.** `export const runtime = 'nodejs'`. `POST(req, { params })`:
  1. `requireAttendUser()` — if null, `401 { error: 'Please sign in to buy tickets' }`.
  2. Parse the body as `{ items: Selection[] }`; `400` on invalid JSON or a non-array `items`.
  3. `startCheckout(user.id, params.id, items, req.nextUrl.origin)` → `200 { url }`.
  4. Map errors: `ValidationError → 400`, `NotFoundError → 404`, else log + `500`. (Same `mapError` shape as `events/[id]/route.ts`.)

- [ ] **Step 2: Verify** — `npx tsc --noEmit`; `npm run build` lists the route.
- [ ] **Step 3: Commit** — `feat(attend): add the checkout API route (Phase 3b task 5)`.

---

## Task 6: Webhook — fulfil ticket orders

**Files:**
- Modify: `src/app/api/attend/webhooks/stripe/route.ts`

- [ ] **Step 1: Route ticket orders.** Import `fulfilCheckout`. In the `checkout.session.completed` branch, add alongside the existing registration check:

```ts
      } else if (session.metadata?.attend_kind === 'ticket_order') {
        await fulfilCheckout(session)
      }
```

No other change — the exactly-once claim, the release-on-failure, and `markWebhookProcessed` already wrap this handler from Phase 2b.

- [ ] **Step 2: Verify** — `npx tsc --noEmit`; `npm run build`.
- [ ] **Step 3: Commit** — `feat(attend): fulfil ticket orders from the Stripe webhook (Phase 3b task 6)`.

---

## Task 7: Checkout UI

**Files:**
- Create: `src/app/attend/events/[slug]/checkout-client.tsx`
- Modify: `src/app/attend/events/[slug]/page.tsx`

- [ ] **Step 1: Build `checkout-client.tsx`.** `'use client'`. Props `{ eventId: string; ticketTypes: TicketTypeRow[]; signedIn: boolean }`.
  - A quantity stepper per **`ACTIVE`** tier (`−` / number / `+`, clamped `0..max_per_order`; `SOLD_OUT`/`PAUSED` tiers from the page are not passed in, or are shown disabled). Quantities held in a `Record<ticketTypeId, number>` `useState`.
  - A live itemized summary: per chosen tier `quantity × formatUsd(unitPrice)`, a **Total** (`formatUsd` of the summed `quantity × price_cents`). This is plain multiplication for display only — no fee logic; under ABSORB/0-tax it equals what the server will charge.
  - If `!signedIn`: the CTA is a `next/link` to `/attend/login` reading "Sign in to get tickets". If `signedIn`: a "Get tickets" button → `POST /api/attend/events/${eventId}/checkout` with `{ items: [{ ticketTypeId, quantity }] for quantity > 0 }`; on `{ url }` `window.location.href = url`; show `{ error }` inline; disable while busy; block submit when the total is 0.
  - Reuse the dark palette and the `inputClass`/`actionBtn` conventions from `ticket-types-panel.tsx`.

- [ ] **Step 2: Wire it into the event page.** In `events/[slug]/page.tsx`: call `getAttendUser()` (returns null when anonymous — the page stays public), and replace the static TICKETS `<section>`'s tier list with `<CheckoutClient eventId={event.id} ticketTypes={ticketTypes} signedIn={!!user} />`. Keep the "Tickets not yet listed." empty state and the "all prices final" line. Pass only non-`HIDDEN` tiers (already filtered by `getEventPage`); the picker itself only renders `ACTIVE` tiers as buyable.

- [ ] **Step 3: Verify** — `npx tsc --noEmit`; `npm test` green; `npm run build` succeeds; the event page + checkout route are listed; no existing route changed.
- [ ] **Step 4: Commit** — `feat(attend): add the checkout UI to the event page (Phase 3b task 7)`.

---

## Verification checklist (whole phase)

- [ ] `npx tsc --noEmit` clean; `npm test` green (incl. new `priceSelections` tests); `npm run build` succeeds.
- [ ] Migrations 017 + 018 applied to Supabase; `attend_create_pending_order`/`attend_complete_checkout` no longer raise "not implemented".
- [ ] Money is computed server-side only; the browser sends just `{ ticketTypeId, quantity }[]`.
- [ ] The webhook path is exactly-once (Phase 2b claim) and `attend_complete_checkout` is idempotent (early-return on a `PAID` order).
- [ ] Inventory: `attend_create_pending_order` holds it under a row lock; oversell is impossible across concurrent buyers.
- [ ] No shared-file edits; no new dependencies.

## Notes & deferrals

- **Cart expiry is Phase 3c** — until then an abandoned `PENDING` order keeps its inventory hold. Acceptable for a test-mode milestone; 3c adds the reclaiming job.
- **Phase 3c must soften the `attend_complete_checkout` non-`PENDING` guard.** Once cart-expiry can set an order `CANCELLED`, a slow payment whose `checkout.session.completed` webhook lands *after* expiry would hit the `status <> 'PENDING'` → `raise` and wedge Stripe into ~3 days of 500 retries. When 3c builds cart-expiry it must change that branch to return a no-op signalling "paid-after-expiry, refund needed" rather than raising. In Phase 3b the branch is unreachable as a wedge — nothing cancels an order yet — so it ships as-is.
- **Wallet is Phase 3c** — `success_url` returns to the event page with `?purchased=1`; the event page may show a brief "payment received" note. No wallet link until 3c.
- **RPC integration tests** (spec §10) need test infrastructure that does not exist yet; deferred to the Phase 7 hardening pass. The RPC bodies rely on careful review here.
- **Separate charges + transfers** (spec §7.4): this phase takes the buyer's payment to the platform; the artist `Transfer` is Phase 6 (payouts). `ARTIST_NET_PENDING` is posted now so the payout job can read it later.
