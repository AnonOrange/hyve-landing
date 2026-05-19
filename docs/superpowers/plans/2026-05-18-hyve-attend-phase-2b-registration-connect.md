# HYVE Attend — Phase 2b: Registration Fee & Stripe Connect — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A creator can pay the $50 show-registration fee through real Stripe (test mode) and onboard a Stripe Connect Express account for payouts — advancing a draft event through the `REGISTRATION_PENDING → PROMOTION_FEE_PAID → PAYOUT_SETUP_REQUIRED → STREAM_SETUP_REQUIRED` setup chain.

**Architecture:** Builds on Phase 1 (the `attend_*` schema, the `attend_pay_registration` RPC stub) and Phase 2a (Attend auth, the events service, the lifecycle state machine). The $50 fee is a one-time Stripe Checkout charge (`mode: 'payment'`, inline `price_data`) modelled on the repo's existing Sentinel flow. An Attend-owned webhook (`/api/attend/webhooks/stripe`, separate from the shared `/api/stripe/webhook`) verifies Stripe events, deduplicates them via `attend_webhook_events`, and on a completed registration payment calls the atomic `attend_pay_registration` RPC. Stripe Connect Express onboarding is entirely new — created via the `stripe` SDK; the same webhook handles `account.updated`. Money-correctness writes go through the atomic RPC; everything else uses the repo's raw-REST Supabase wrapper.

**Tech Stack:** Next.js 14 App Router · TypeScript · Supabase (raw-REST + the RPC) · Stripe (`stripe` SDK, test mode) · Vitest.

**Source spec:** `docs/superpowers/specs/2026-05-18-hyve-attend-mvp-design.md` — implements build-order Phase 2 (§11.2), the registration + Connect slice. §5.3 (`attend_pay_registration`), §6.9 (lifecycle), §16 (payments/ledger).

**Scope — in this plan:** the `attend_pay_registration` RPC body, the $50 Stripe checkout, the Attend Stripe webhook (registration + Connect events), Stripe Connect Express onboarding, the lifecycle wiring through the setup chain, and minimal creator UI to drive it.
**Scope — deferred to plan 2c:** the full creator dashboard UI, stream setup. (Ticket checkout / artist payouts are Phase 3 / Phase 6.)

**Branch:** `attend-phase-2b-payments` (already created off `main`).

**Prerequisites for runtime (flag to the human — not code):**
- `STRIPE_SECRET_KEY` must be a **test-mode** key (already in `.env.local` for the existing products).
- A new `STRIPE_ATTEND_WEBHOOK_SECRET` env var — created when the Stripe webhook endpoint for `/api/attend/webhooks/stripe` is registered in the Stripe Dashboard.
- **Stripe Connect must be enabled** on the account (`acct_1SzPpHBDu7iAqCsH`) for Express accounts — Dashboard → Connect → Get started.

## Conventions for this plan

- Route handlers: `export const runtime = 'nodejs'`; auth via `requireCreator()` (`@/lib/attend/identity/roles`) → `401` if null.
- Stripe: `new Stripe(process.env.STRIPE_SECRET_KEY!)` — the same construction the existing `api/stripe/webhook/route.ts` uses.
- Data access: `supaGet/supaPost/supaPatch/supaDelete` from `@/lib/supabase`; the atomic RPC via `supaPost('rpc/attend_pay_registration', { p_args: args })` — PostgREST keys the RPC body by the function's parameter name (`p_args`), not the inner fields.
- Errors reuse `ForbiddenError/NotFoundError/ValidationError` from `@/lib/attend/events/service`.
- Commits: conventional-commit, `feat(attend): ...`, one per task.

## File Structure

| File | Responsibility |
|------|----------------|
| `supabase/migrations/015_attend_pay_registration.sql` | The `attend_pay_registration` RPC body (replaces the Phase 1 stub) |
| `src/lib/attend/payments/stripe.ts` | Shared `stripe` SDK client + Attend Stripe constants |
| `src/lib/attend/payments/payments-repository.ts` | Raw-REST access for `attend_payments` and `attend_webhook_events` |
| `src/lib/attend/payments/registration-service.ts` | Start a registration checkout; fulfil it (record payment + call the RPC) |
| `src/lib/attend/payments/connect-service.ts` | Stripe Connect Express: create account, account link, sync status |
| `src/app/api/attend/events/[id]/pay-registration/route.ts` | `POST` — start the $50 checkout |
| `src/app/api/attend/connect/onboard/route.ts` | `POST` — create/continue Connect onboarding |
| `src/app/api/attend/connect/return/route.ts` | `GET` — Connect onboarding return redirect |
| `src/app/api/attend/connect/refresh/route.ts` | `GET` — Connect onboarding link-refresh redirect |
| `src/app/api/attend/webhooks/stripe/route.ts` | `POST` — Attend's Stripe webhook (registration + `account.updated`) |
| `src/lib/attend/events/service.ts` | **Modify** — add `advanceSetup()` for the post-payment / post-Connect transitions |
| `src/app/attend/(creator)/creator/creator-events-client.tsx` | **Modify** — add "Pay registration" + "Connect payouts" actions |
| `src/app/attend/(creator)/creator/page.tsx` | **Modify** — also load the creator's payout-account state |

---

## Chunk 1: The $50 registration fee

### Task 1: Migration 015 — the `attend_pay_registration` RPC body

Replaces the Phase 1 stub with the real atomic body (spec §5.3).

**Files:**
- Create: `supabase/migrations/015_attend_pay_registration.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/015_attend_pay_registration.sql`:

```sql
-- HYVE Attend — attend_pay_registration RPC body (replaces the Phase 1 stub).
-- Atomically: move the event REGISTRATION_PENDING -> PROMOTION_FEE_PAID,
-- create its $50 promotion campaign, and post the registration ledger
-- entries. Idempotent — a retried webhook is a no-op.

create or replace function attend_pay_registration(p_args jsonb)
returns jsonb language plpgsql as $$
declare
  v_event_id   uuid := (p_args->>'event_id')::uuid;
  v_payment_id uuid := nullif(p_args->>'payment_id', '')::uuid;
  v_actor      text := coalesce(p_args->>'actor', 'system');
  v_status     attend_event_status;
begin
  select status into v_status from attend_events where id = v_event_id for update;
  if v_status is null then
    raise exception 'attend_pay_registration: event % not found', v_event_id;
  end if;

  -- Already processed (retried webhook) — no-op.
  if v_status <> 'REGISTRATION_PENDING' then
    return jsonb_build_object('event_id', v_event_id, 'status', v_status, 'already_done', true);
  end if;

  update attend_events
     set status = 'PROMOTION_FEE_PAID', updated_at = now(), updated_by = v_actor
   where id = v_event_id;

  insert into attend_promotion_campaigns (event_id, budget_cents, status)
  values (v_event_id, 5000, 'ACTIVE')
  on conflict (event_id) do nothing;

  insert into attend_ledger_entries
    (event_id, payment_id, type, amount_cents, currency, description, source, created_by)
  values
    (v_event_id, v_payment_id, 'PROMOTION_REGISTRATION_FEE', 5000, 'usd',
     'Show registration fee', 'SYSTEM', v_actor),
    (v_event_id, v_payment_id, 'PROMOTION_BUDGET_ALLOCATED', 5000, 'usd',
     'Promotion budget allocated from the registration fee', 'SYSTEM', v_actor);

  return jsonb_build_object('event_id', v_event_id, 'status', 'PROMOTION_FEE_PAID');
end $$;
```

- [ ] **Step 2: Apply the migration**

Apply `015_attend_pay_registration.sql` in the Supabase SQL editor (or via the Supabase MCP `apply_migration` to project `jlyqezwuyhfevrdomazd`).
Expected: `create or replace function` succeeds.

- [ ] **Step 3: Verify**

Run in the Supabase SQL editor: `select attend_pay_registration('{"event_id":"00000000-0000-0000-0000-000000000000"}'::jsonb);`
Expected: it raises `event ... not found` (proving the body runs, not the old stub's `not implemented`).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/015_attend_pay_registration.sql
git commit -m "feat(attend): implement the attend_pay_registration RPC"
```

### Task 2: Stripe client + payments repository

**Files:**
- Create: `src/lib/attend/payments/stripe.ts`
- Create: `src/lib/attend/payments/payments-repository.ts`

- [ ] **Step 1: Write the Stripe client module**

Create `src/lib/attend/payments/stripe.ts` — exports `attendStripe()` returning `new Stripe(process.env.STRIPE_SECRET_KEY!)`, and the constant `REGISTRATION_FEE_CENTS = 5000`. One construction site so later phases share it.

- [ ] **Step 2: Write the payments repository**

Create `src/lib/attend/payments/payments-repository.ts` — raw-REST over `attend_payments` and `attend_webhook_events`:
- `insertPayment(row): Promise<PaymentRow>` — insert into `attend_payments`, `return=representation`.
- `findPaymentByIntent(stripePaymentIntentId): Promise<PaymentRow | null>`.
- `markWebhookSeen(provider, providerEventId, eventType, payload): Promise<boolean>` — insert into `attend_webhook_events` via a plain `supaPost`. `provider_event_id` is `unique`: a successful insert (`res.ok`) means the event is new — return `true`; HTTP `409` (unique-constraint violation) means it was already processed — return `false`; any other status — throw. Status-code-based, so it never depends on parsing the response body.
- `markWebhookProcessed(providerEventId): Promise<void>` — set `processed_at = now()`.
Export `PaymentRow` (columns from spec §5.2).

- [ ] **Step 3: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/attend/payments/stripe.ts src/lib/attend/payments/payments-repository.ts
git commit -m "feat(attend): add Stripe client and payments repository"
```

### Task 3: The registration service + checkout route

**Files:**
- Create: `src/lib/attend/payments/registration-service.ts`
- Create: `src/app/api/attend/events/[id]/pay-registration/route.ts`

- [ ] **Step 1: Write the registration service**

Create `src/lib/attend/payments/registration-service.ts`:
- `startRegistrationCheckout(eventId, creatorId, origin): Promise<{ url: string }>` — load the event via the events repository; ownership check (`ForbiddenError`); require `status === 'REGISTRATION_PENDING'` (`ValidationError` otherwise); a `FREE_EVENT` never reaches this state, so no extra check is needed. Create a Stripe Checkout session: `mode: 'payment'`, one `line_items` entry with inline `price_data` (`currency: 'usd'`, `unit_amount: 5000`, `product_data.name: 'HYVE Attend — show registration'`), `metadata: { attend_kind: 'registration', attend_event_id: eventId, attend_actor: creatorId }`, `success_url: ${origin}/attend/creator?registered=1`, `cancel_url: ${origin}/attend/creator?cancelled=1`. Return `{ url: session.url! }`.
- `fulfilRegistration(session): Promise<void>` — given a completed `Stripe.Checkout.Session` whose `metadata.attend_kind === 'registration'`: insert an `attend_payments` row (`kind: 'REGISTRATION_FEE'`, `event_id`, `profile_id` = `attend_actor`, `amount_cents: 5000`, `status: 'SUCCEEDED'`, `stripe_payment_intent_id`, `stripe_checkout_session_id`); then call the RPC via `supaPost('rpc/attend_pay_registration', { p_args: { event_id, payment_id, actor } })` — the body must be keyed by the function's `jsonb` parameter name `p_args`. Check `res.ok`.

- [ ] **Step 2: Write the checkout route**

Create `src/app/api/attend/events/[id]/pay-registration/route.ts` — `POST`: `requireCreator()` → `401`; derive `origin` from `req.nextUrl.origin`; call `startRegistrationCheckout(params.id, profile.id, origin)`; return `{ url }`. Map `ValidationError`→400, `ForbiddenError`→403, `NotFoundError`→404, else 500.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build succeeds; `/api/attend/events/[id]/pay-registration` present.

- [ ] **Step 4: Commit**

```bash
git add src/lib/attend/payments/registration-service.ts "src/app/api/attend/events/[id]/pay-registration"
git commit -m "feat(attend): add the $50 registration checkout"
```

### Task 4: The Attend Stripe webhook

**Files:**
- Create: `src/app/api/attend/webhooks/stripe/route.ts`
- Modify: `.env.example` (add `STRIPE_ATTEND_WEBHOOK_SECRET`)

- [ ] **Step 1: Write the webhook handler**

Create `src/app/api/attend/webhooks/stripe/route.ts`. Pattern follows the repo's `api/stripe/webhook/route.ts`:
- `export const runtime = 'nodejs'`.
- `POST`: read `await req.text()` (raw body) and the `stripe-signature` header; verify with `attendStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_ATTEND_WEBHOOK_SECRET!)`; on verification failure return `400`.
- Deduplicate: `markWebhookSeen('STRIPE', event.id, event.type, event.data.object)`; if it returns `false`, return `200 { received: true, duplicate: true }` immediately.
- Route by `event.type` inside a try/catch (never surface handler errors to Stripe — log them; always return `200`):
  - `checkout.session.completed` → if `session.metadata?.attend_kind === 'registration'`, call `fulfilRegistration(session)`.
  - `account.updated` → (Connect) handled in Task 6 — leave a `// Connect: Task 6` placeholder branch now.
  - other types → ignore.
- On success call `markWebhookProcessed(event.id)`, return `200 { received: true }`.

- [ ] **Step 2: Document the env var**

Append to `.env.example` under a `# --- HYVE Attend ---` comment: `STRIPE_ATTEND_WEBHOOK_SECRET=whsec_...` with a note that it comes from the Stripe Dashboard webhook endpoint for `/api/attend/webhooks/stripe`.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build succeeds; `/api/attend/webhooks/stripe` present.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/attend/webhooks/stripe" .env.example
git commit -m "feat(attend): add the Attend Stripe webhook with registration fulfilment"
```

---

## Chunk 2: Stripe Connect onboarding

### Task 5: Connect service + onboarding routes

**Files:**
- Create: `src/lib/attend/payments/connect-service.ts`
- Create: `src/app/api/attend/connect/onboard/route.ts`
- Create: `src/app/api/attend/connect/return/route.ts`
- Create: `src/app/api/attend/connect/refresh/route.ts`

- [ ] **Step 1: Write the Connect service**

Create `src/lib/attend/payments/connect-service.ts`:
- `getOrCreatePayoutAccount(creatorId, email): Promise<{ stripeAccountId: string }>` — look up `attend_payout_accounts` by `profile_id`; if a row exists, return its `stripe_connect_account_id`; otherwise `attendStripe().accounts.create({ type: 'express', email, capabilities: { transfers: { requested: true } } })`, insert an `attend_payout_accounts` row (`status: 'ONBOARDING'`, `charges_enabled: false`, `payouts_enabled: false`), and return the new id.
- `createOnboardingLink(stripeAccountId, origin): Promise<string>` — `attendStripe().accountLinks.create({ account, type: 'account_onboarding', return_url: ${origin}/api/attend/connect/return, refresh_url: ${origin}/api/attend/connect/refresh })`; return `.url`.
- `syncAccountStatus(stripeAccountId): Promise<void>` — retrieve the account, `supaPatch('attend_payout_accounts', stripe_connect_account_id=eq.${id}, { charges_enabled, payouts_enabled, status })` where `status` becomes `'VERIFIED'` when `payouts_enabled` is true, else stays `'ONBOARDING'`.

- [ ] **Step 2: Write the onboard route**

Create `src/app/api/attend/connect/onboard/route.ts` — `POST`: `requireCreator()` → `401`; `getOrCreatePayoutAccount(profile.id, profile.email)`; `createOnboardingLink(accountId, req.nextUrl.origin)`; return `{ url }`.

- [ ] **Step 3: Write the return + refresh routes**

Create `connect/return/route.ts` — `GET`: `requireCreator()`; look up the creator's payout account; `syncAccountStatus(...)`; `NextResponse.redirect(${origin}/attend/creator?connect=done)`.
Create `connect/refresh/route.ts` — `GET`: `requireCreator()`; rebuild an onboarding link via `getOrCreatePayoutAccount(profile.id, profile.email)` then `createOnboardingLink(...)`, and `redirect` to it (the prior link expired; mint a fresh one).

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: build succeeds; the three `/api/attend/connect/*` routes present.

- [ ] **Step 5: Commit**

```bash
git add src/lib/attend/payments/connect-service.ts "src/app/api/attend/connect"
git commit -m "feat(attend): add Stripe Connect Express onboarding"
```

### Task 6: Connect webhook handling

**Files:**
- Modify: `src/app/api/attend/webhooks/stripe/route.ts`

- [ ] **Step 1: Wire `account.updated`**

In the webhook's event router, replace the Task 4 placeholder branch: on `account.updated`, call `syncAccountStatus((event.data.object as Stripe.Account).id)` so the creator's `attend_payout_accounts` row reflects Stripe's verification state without waiting for the return redirect.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/attend/webhooks/stripe"
git commit -m "feat(attend): handle Connect account.updated in the Attend webhook"
```

---

## Chunk 3: Lifecycle wiring & creator UI

### Task 7: Setup-chain transitions

After the $50 is paid the event is `PROMOTION_FEE_PAID`; once payouts are enabled it should reach `STREAM_SETUP_REQUIRED`. This task adds the guarded service method and removes the unguarded creator-facing status PATCH the Phase 2a review flagged.

**Files:**
- Modify: `src/lib/attend/events/service.ts`
- Modify: `src/app/api/attend/events/[id]/route.ts`

- [ ] **Step 1: Add `advanceSetup` to the events service**

In `service.ts` add `advanceSetup(eventId, creatorId): Promise<EventStatus>` — load the owned event; based on its current status, perform the next *guarded* transition:
- `PROMOTION_FEE_PAID` → `PAYOUT_SETUP_REQUIRED` (automatic).
- `PAYOUT_SETUP_REQUIRED` → `STREAM_SETUP_REQUIRED` **only if** the creator's `attend_payout_accounts` row has `payouts_enabled = true` (else `ValidationError('Complete Stripe Connect onboarding first')`).
- any other status → `ValidationError('Nothing to advance')`.
Each transition still goes through `assertTransition`. Return the new status.

- [ ] **Step 2: Restrict the status PATCH**

In `src/app/api/attend/events/[id]/route.ts`, change the `PATCH` handler: a `status` field in the body is no longer accepted as a free-form transition. Instead, accept `{ "action": "advance-setup" }` → call `advanceSetup`; `{ "action": "cancel" }` → `changeEventStatus(... 'CANCELLED')`. Any other `status`/`action` value → `400`. (Plain detail edits still route to `updateEventDetails`.) This closes the unguarded-transition surface; `changeEventStatus` stays internal/cancellation-only until later phases add the remaining authority checks.

- [ ] **Step 3: Verify build + type-check**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed.

- [ ] **Step 4: Commit**

```bash
git add src/lib/attend/events/service.ts "src/app/api/attend/events/[id]"
git commit -m "feat(attend): add guarded setup-chain transitions, restrict status PATCH"
```

### Task 8: Creator UI — registration + Connect actions

**Files:**
- Modify: `src/app/attend/(creator)/creator/creator-events-client.tsx`
- Modify: `src/app/attend/(creator)/creator/page.tsx`

- [ ] **Step 1: Surface payout + registration state**

In `page.tsx`, also load the creator's `attend_payout_accounts` row (a small raw-REST read or a `connect-service` getter) and pass `payoutsEnabled` to the client.

- [ ] **Step 2: Add the actions to the client component**

In `creator-events-client.tsx`:
- A "Connect payouts" button (shown when `payoutsEnabled` is false) → `POST /api/attend/connect/onboard` → redirect to the returned `url`. When `payoutsEnabled` is true, show "Payouts connected ✓".
- Per event, when `status === 'REGISTRATION_PENDING'`, a "Pay $50 registration" button → `POST /api/attend/events/{id}/pay-registration` → redirect to the returned Checkout `url`.
- Per event, when `status === 'PROMOTION_FEE_PAID'` or `'PAYOUT_SETUP_REQUIRED'`, an "Advance setup" button → `PATCH /api/attend/events/{id}` with `{ action: 'advance-setup' }` → `window.location.reload()`; show the returned error inline on `400`.

- [ ] **Step 3: Verify build + manual check**

Run: `npm run build` — succeeds.
Then `npm run dev`: as a signed-in creator, confirm a `REGISTRATION_PENDING` event shows "Pay $50 registration" and the "Connect payouts" button is present. (Completing the real Stripe flows needs the test keys + webhook secret + Connect enabled — see Prerequisites.)

- [ ] **Step 4: Commit**

```bash
git add "src/app/attend/(creator)/creator"
git commit -m "feat(attend): add registration + Connect actions to the creator page"
```

---

## Phase 2b completion check

- `npm test` passes (the Phase 1/2a suites — Phase 2b adds no pure-logic unit tests; it is integration code verified by build + type-check).
- `npm run build` succeeds with the new `/api/attend/events/[id]/pay-registration`, `/api/attend/connect/*`, and `/api/attend/webhooks/stripe` routes.
- `attend_pay_registration` is a real function in Supabase (no longer the stub).
- A creator can launch the $50 Stripe Checkout and the Connect onboarding flow from `/attend/creator`; a completed registration payment moves the event to `PROMOTION_FEE_PAID` via the webhook → RPC.
- The event status PATCH no longer accepts free-form transitions — only `advance-setup` (guarded) and `cancel`.
- Additive only: new files plus `.env.example`, and surgical edits to `events/service.ts`, `events/[id]/route.ts`, and the creator page/client. No other product is touched.

**Next:** Plan 2c — the full creator dashboard (event detail, stream setup, sales/promotion/payout views).
