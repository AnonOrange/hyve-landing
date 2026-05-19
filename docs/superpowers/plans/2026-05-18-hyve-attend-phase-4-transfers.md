# HYVE Attend — Phase 4: Ticket Transfers Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax. Executed in-session against the `attend-phase-4-transfers` branch. Money/ownership-critical — the three RPC bodies are the correctness surface.

**Goal:** A ticket owner can transfer a ticket by email or by friend code; a recipient can claim it; the sender can revoke a pending transfer.

**Architecture:** Three atomic Postgres RPCs do the ownership-critical writes — `attend_create_transfer` (owner → pending), `attend_claim_transfer` (pending → recipient owns it), `attend_revoke_transfer` (pending → back to the owner). A `transfers` module composes them with the existing `attend_ticket_transfers` table; email-method transfers send a claim link via Resend. The wallet gains per-ticket transfer controls; `/attend/claim` hosts the recipient flow.

**Tech Stack:** Next.js 14, TypeScript (strict), Tailwind, Vitest, plpgsql migrations, Resend (`resend` package — already a dependency). Migrations applied to Supabase via the MCP `apply_migration` tool (project ref `jlyqezwuyhfevrdomazd`).

---

## Context for the executor

Phases 1–3 are merged: a buyer can buy tickets and see them at `/attend/wallet` (`ASSIGNED_TO_BUYER`). No transfer path exists.

**Schema (already migrated):**
- `attend_ticket_transfers` — `id, ticket_id (FK attend_tickets), from_profile_id (FK attend_profiles), to_email, to_profile_id (FK attend_profiles), method (attend_transfer_method: EMAIL/FRIEND_CODE), claim_token (unique), friend_code (unique), status (attend_transfer_status: PENDING/ACCEPTED/REVOKED/EXPIRED), accepted_at, revoked_at, expires_at (not null), created_at`.
- `attend_tickets` — `…, owner_id, state (attend_ticket_state)`. A transferable ticket is `ASSIGNED_TO_BUYER` or `TRANSFER_ACCEPTED`; a pending one is `TRANSFER_PENDING_EMAIL` / `TRANSFER_PENDING_FRIEND_CODE`.
- `attend_events` — `starts_at, transfer_cutoff_hours`.
- RPC stub `attend_claim_transfer(p_args jsonb)` exists in migration 014 (`raise … 'not implemented (Phase 4)'`).

**Spec basis** — §7.7 (transfers) and the §7.9 ticket transitions:
- `ASSIGNED_TO_BUYER`/`TRANSFER_ACCEPTED` → `TRANSFER_PENDING_EMAIL`|`TRANSFER_PENDING_FRIEND_CODE` — guards: not checked in, no refund/dispute, before the transfer cutoff. (The from-state check enforces "not checked in / no refund / no dispute" — those states are outside the idle set.)
- `TRANSFER_PENDING_*` → `TRANSFER_ACCEPTED` — recipient accepts; transfer not expired/revoked.
- `TRANSFER_PENDING_*` → owned-idle state — owner revokes. The **owned-idle state** is `ASSIGNED_TO_BUYER` if the ticket's `owner_id` equals its order's `buyer_id`, otherwise `TRANSFER_ACCEPTED`.

**Decisions baked into this plan:**
- **Transfer RPCs return a structured `{ ok, error?, … }`** rather than `raise`-ing for *expected user-facing* failures (expired link, already claimed, past cutoff, not your transfer). The transfer domain has many normal failure modes; a structured return lets the service surface a clean message as an HTTP 400 without parsing PostgREST error bodies. (This differs deliberately from the checkout RPCs, whose failures are races and `raise`.) A genuinely-impossible case (a NULL FK) still `raise`s.
- **Codes are generated in TypeScript** and passed into the RPC: `claim_token` (192-bit, URL-safe) and `friend_code` (`HYVE-XXXX-XXXX`, unambiguous alphabet). The `unique` constraints backstop the negligible collision chance.
- **Claim-expiry is deferred to Phase 7.** `expires_at` is set on every transfer row, but the background job that flips a stale `PENDING` transfer to `EXPIRED` is wired with the other §4.6 jobs in the hardening pass. A sender can always revoke meanwhile, so a ticket is never permanently stuck. `attend_claim_transfer` still rejects an expired transfer at claim time, so `expires_at` is enforced.
- **Self-claim is rejected** (`from_profile_id == recipient`).
- Email uses `new Resend(RESEND_API_KEY).emails.send(...)` with `from: 'HYVE Attend <onboarding@resend.dev>'` (matching `src/app/api/report/route.ts` — the domain is not yet verified on Resend). A missing `RESEND_API_KEY` makes an email transfer fail with a clear error.

## File Structure

**Create:**
- `supabase/migrations/021_attend_create_transfer.sql`, `022_attend_claim_transfer.sql`, `023_attend_revoke_transfer.sql`.
- `src/lib/attend/transfers/transfer-codes.ts` + `transfer-codes.test.ts` — pure code/token generation.
- `src/lib/attend/transfers/transfer-repository.ts` — raw-REST reads of `attend_ticket_transfers`.
- `src/lib/attend/transfers/transfer-service.ts` — `initiateTransfer`, `revokeTransfer`, `claimTransfer`.
- `src/app/api/attend/tickets/[id]/transfer/route.ts` — `POST` initiate.
- `src/app/api/attend/transfers/[id]/revoke/route.ts` — `POST` revoke.
- `src/app/api/attend/transfers/claim/route.ts` — `POST` claim.
- `src/app/attend/claim/page.tsx` + `claim-client.tsx` — the recipient claim flow. Deliberately **outside** the `(attendee)` group: an anonymous recipient must be able to view it; only the claim *action* gates auth. Placed directly under `attend/` so only the shell `attend/layout.tsx` (no auth gate) wraps it.
- `src/app/attend/(attendee)/wallet/wallet-ticket.tsx` — the per-ticket client component (transfer/revoke controls).

**Modify:**
- `src/lib/attend/ticketing/ticket-repository.ts` — embed pending transfers in `OwnedTicket`.
- `src/app/attend/(attendee)/wallet/page.tsx` — render `<WalletTicket>` per ticket.

---

## Task 1: Transfer-code helpers

**Files:**
- Create: `src/lib/attend/transfers/transfer-codes.ts`, `src/lib/attend/transfers/transfer-codes.test.ts`

- [ ] **Step 1: Write the failing test** — `transfer-codes.test.ts`. For `friendCode()`: assert it matches `/^HYVE-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/`, and that 500 calls produce 500 distinct values. For `claimToken()`: assert it is URL-safe (`/^[A-Za-z0-9_-]+$/`), length ≥ 32, and 500 calls are distinct.

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Write `transfer-codes.ts`:**

```ts
import { randomBytes, randomInt } from 'crypto'

// No 0/O/1/I/L — codes are read aloud and typed by hand.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function block(): string {
  let s = ''
  for (let i = 0; i < 4; i++) s += ALPHABET[randomInt(ALPHABET.length)]
  return s
}

/** A shareable one-time friend code, e.g. HYVE-7K2M-PQ4R. */
export function friendCode(): string {
  return `HYVE-${block()}-${block()}`
}

/** A 192-bit URL-safe token for an email transfer's claim link. */
export function claimToken(): string {
  return randomBytes(24).toString('base64url')
}
```

- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Verify** — `npx tsc --noEmit`.
- [ ] **Step 6: Commit** — `feat(attend): add transfer-code generation (Phase 4 task 1)`.

---

## Task 2: `attend_create_transfer` RPC

**Files:**
- Create: `supabase/migrations/021_attend_create_transfer.sql`

- [ ] **Step 1: Write the migration.**

```sql
-- HYVE Attend — attend_create_transfer RPC. Atomically opens a ticket
-- transfer: inserts the attend_ticket_transfers row and moves the ticket to a
-- TRANSFER_PENDING_* state. Returns { ok, error? } — expected user-facing
-- failures do not raise.
create or replace function attend_create_transfer(p_args jsonb)
returns jsonb language plpgsql as $$
declare
  v_ticket_id   uuid := (p_args->>'ticket_id')::uuid;
  v_from        uuid := (p_args->>'from_profile_id')::uuid;
  v_method      text := p_args->>'method';
  v_ticket      attend_tickets%rowtype;
  v_event       attend_events%rowtype;
  v_new_state   attend_ticket_state;
  v_transfer_id uuid;
begin
  select * into v_ticket from attend_tickets where id = v_ticket_id for update;
  if v_ticket.id is null then
    return jsonb_build_object('ok', false, 'error', 'Ticket not found.');
  end if;
  if v_ticket.owner_id is null or v_ticket.owner_id <> v_from then
    return jsonb_build_object('ok', false, 'error', 'This is not your ticket.');
  end if;
  if v_ticket.state not in ('ASSIGNED_TO_BUYER', 'TRANSFER_ACCEPTED') then
    return jsonb_build_object('ok', false, 'error', 'This ticket cannot be transferred right now.');
  end if;

  select * into v_event from attend_events where id = v_ticket.event_id;
  if v_event.starts_at is not null
     and now() >= v_event.starts_at - make_interval(hours => v_event.transfer_cutoff_hours) then
    return jsonb_build_object('ok', false, 'error', 'The transfer window for this event has closed.');
  end if;

  v_new_state := case
    when v_method = 'FRIEND_CODE' then 'TRANSFER_PENDING_FRIEND_CODE'::attend_ticket_state
    else 'TRANSFER_PENDING_EMAIL'::attend_ticket_state
  end;

  insert into attend_ticket_transfers
    (ticket_id, from_profile_id, to_email, method, claim_token, friend_code, status, expires_at)
  values
    (v_ticket_id, v_from, nullif(p_args->>'to_email', ''), v_method,
     nullif(p_args->>'claim_token', ''), nullif(p_args->>'friend_code', ''),
     'PENDING', (p_args->>'expires_at')::timestamptz)
  returning id into v_transfer_id;

  update attend_tickets set state = v_new_state, updated_at = now() where id = v_ticket_id;

  return jsonb_build_object('ok', true, 'transfer_id', v_transfer_id, 'ticket_state', v_new_state);
end $$;
```

- [ ] **Step 2: Apply** via the MCP `apply_migration` tool (name `attend_create_transfer`). Confirm success.
- [ ] **Step 3: Commit** — `feat(attend): implement the attend_create_transfer RPC (Phase 4 task 2)`.

---

## Task 3: `attend_claim_transfer` RPC

**Files:**
- Create: `supabase/migrations/022_attend_claim_transfer.sql`

- [ ] **Step 1: Write the migration** (replaces the migration-014 stub).

```sql
-- HYVE Attend — attend_claim_transfer RPC body (replaces the Phase 1 stub).
-- Atomically reassigns a pending transfer's ticket to the recipient. Returns
-- { ok, error? } — an expired/taken/invalid link does not raise.
create or replace function attend_claim_transfer(p_args jsonb)
returns jsonb language plpgsql as $$
declare
  v_token     text := nullif(p_args->>'claim_token', '');
  v_code      text := nullif(p_args->>'friend_code', '');
  v_recipient uuid := (p_args->>'recipient_id')::uuid;
  v_transfer  attend_ticket_transfers%rowtype;
  v_ticket    attend_tickets%rowtype;
begin
  if v_token is not null then
    select * into v_transfer from attend_ticket_transfers where claim_token = v_token for update;
  elsif v_code is not null then
    select * into v_transfer from attend_ticket_transfers where friend_code = v_code for update;
  else
    return jsonb_build_object('ok', false, 'error', 'A claim link or friend code is required.');
  end if;

  if v_transfer.id is null then
    return jsonb_build_object('ok', false, 'error', 'This transfer link is not valid.');
  end if;
  if v_transfer.status <> 'PENDING' then
    return jsonb_build_object('ok', false, 'error', 'This transfer is no longer available.');
  end if;
  if now() >= v_transfer.expires_at then
    return jsonb_build_object('ok', false, 'error', 'This transfer has expired.');
  end if;
  if v_transfer.from_profile_id = v_recipient then
    return jsonb_build_object('ok', false, 'error', 'You cannot claim your own transfer.');
  end if;

  select * into v_ticket from attend_tickets where id = v_transfer.ticket_id for update;
  if v_ticket.state not in ('TRANSFER_PENDING_EMAIL', 'TRANSFER_PENDING_FRIEND_CODE') then
    return jsonb_build_object('ok', false, 'error', 'This ticket is no longer awaiting a claim.');
  end if;

  update attend_ticket_transfers
     set status = 'ACCEPTED', to_profile_id = v_recipient, accepted_at = now()
   where id = v_transfer.id;

  update attend_tickets
     set state = 'TRANSFER_ACCEPTED', owner_id = v_recipient, updated_at = now()
   where id = v_ticket.id;

  return jsonb_build_object('ok', true, 'ticket_id', v_ticket.id, 'event_id', v_ticket.event_id);
end $$;
```

- [ ] **Step 2: Apply** via `apply_migration` (name `attend_claim_transfer`). Confirm success.
- [ ] **Step 3: Commit** — `feat(attend): implement the attend_claim_transfer RPC (Phase 4 task 3)`.

---

## Task 4: `attend_revoke_transfer` RPC

**Files:**
- Create: `supabase/migrations/023_attend_revoke_transfer.sql`

- [ ] **Step 1: Write the migration.** Returns the ticket to its owned-idle state.

```sql
-- HYVE Attend — attend_revoke_transfer RPC. The sender cancels a pending
-- transfer; the ticket returns to its owned-idle state (ASSIGNED_TO_BUYER if
-- the owner is the order's buyer, else TRANSFER_ACCEPTED). Returns { ok, error? }.
create or replace function attend_revoke_transfer(p_args jsonb)
returns jsonb language plpgsql as $$
declare
  v_transfer_id uuid := (p_args->>'transfer_id')::uuid;
  v_actor       uuid := (p_args->>'actor_id')::uuid;
  v_transfer    attend_ticket_transfers%rowtype;
  v_ticket      attend_tickets%rowtype;
  v_buyer       uuid;
  v_idle_state  attend_ticket_state;
begin
  select * into v_transfer from attend_ticket_transfers where id = v_transfer_id for update;
  if v_transfer.id is null then
    return jsonb_build_object('ok', false, 'error', 'Transfer not found.');
  end if;
  if v_transfer.from_profile_id <> v_actor then
    return jsonb_build_object('ok', false, 'error', 'This is not your transfer to revoke.');
  end if;
  if v_transfer.status <> 'PENDING' then
    return jsonb_build_object('ok', false, 'error', 'Only a pending transfer can be revoked.');
  end if;

  select * into v_ticket from attend_tickets where id = v_transfer.ticket_id for update;
  select buyer_id into v_buyer from attend_orders where id = v_ticket.order_id;
  v_idle_state := case
    when v_ticket.owner_id = v_buyer then 'ASSIGNED_TO_BUYER'::attend_ticket_state
    else 'TRANSFER_ACCEPTED'::attend_ticket_state
  end;

  update attend_ticket_transfers
     set status = 'REVOKED', revoked_at = now() where id = v_transfer_id;
  update attend_tickets
     set state = v_idle_state, updated_at = now() where id = v_ticket.id;

  return jsonb_build_object('ok', true, 'ticket_state', v_idle_state);
end $$;
```

- [ ] **Step 2: Apply** via `apply_migration` (name `attend_revoke_transfer`). Confirm success.
- [ ] **Step 3: Commit** — `feat(attend): implement the attend_revoke_transfer RPC (Phase 4 task 4)`.

---

## Task 5: Transfer + ticket repositories

**Files:**
- Create: `src/lib/attend/transfers/transfer-repository.ts`
- Modify: `src/lib/attend/ticketing/ticket-repository.ts`

- [ ] **Step 1: `transfer-repository.ts`** — raw-REST reads of `attend_ticket_transfers`, query-only. Define `TransferRow` (all columns) and:
  - `getTransferForClaim(by: { claimToken?: string; friendCode?: string })` — looks up a transfer by `claim_token` or `friend_code`, embedding the ticket's event for display: `select=id,status,expires_at,method,attend_tickets(attend_events(title,slug))`. Returns the row or `null`.
  - `getTransferById(id)` — plain `select=*`, returns row or `null`.

- [ ] **Step 2: Extend `ticket-repository.ts`.** Add a pending-transfer embed to `OwnedTicket` so the wallet can show transfer state without a second query. Add to the `OwnedTicket` interface:
  ```ts
  attend_ticket_transfers: {
    id: string
    method: string
    friend_code: string | null
    to_email: string | null
    status: string
  }[]
  ```
  And to the `select` in `listOwnedTicketsWithContext`: `,attend_ticket_transfers(id,method,friend_code,to_email,status)`. (A ticket has at most one `PENDING` transfer at a time — initiating one moves the ticket out of the idle set — so the wallet picks the `status === 'PENDING'` row.)

- [ ] **Step 3: Verify** — `npx tsc --noEmit`; `npm test` green (the Phase 3c `wallet-grouping` test builds `OwnedTicket` fixtures — update that factory to include `attend_ticket_transfers: []`).
- [ ] **Step 4: Commit** — `feat(attend): add the transfer repository + pending-transfer embed (Phase 4 task 5)`.

---

## Task 6: Transfer service

**Files:**
- Create: `src/lib/attend/transfers/transfer-service.ts`

- [ ] **Step 1: Build the service.** Three functions; all RPC calls via `supaPost('rpc/…', { p_args })`; an RPC result with `ok === false` becomes a `ValidationError(result.error)`; a non-OK HTTP response throws a generic `Error`.

  - `initiateTransfer(ticketId, fromProfileId, method, toEmail | null, origin)`:
    - For `EMAIL`: require a non-empty `toEmail` (else `ValidationError`); generate `claimToken()`.
    - For `FRIEND_CODE`: generate `friendCode()`.
    - `expires_at` = now + **7 days** (ISO).
    - Call `attend_create_transfer` with the ids/method/code/token/`expires_at`.
    - For `EMAIL` on success, send the claim email via Resend — `to: toEmail`, a link `${origin}/attend/claim?token=${claimToken}`. If `RESEND_API_KEY` is unset, throw `ValidationError('Email transfers are not available right now.')`. A Resend send failure throws (the transfer row already exists; the sender can revoke + retry).
    - Return `{ friendCode }` for `FRIEND_CODE`, `{}` for `EMAIL`.
  - `revokeTransfer(transferId, actorId)` — call `attend_revoke_transfer`; map `ok:false` → `ValidationError`.
  - `claimTransfer(by: { claimToken?; friendCode? }, recipientId)` — call `attend_claim_transfer`; map `ok:false` → `ValidationError`; return `{ eventId }`.

  Imports: `attendStripe` is NOT needed; use `Resend` from `'resend'`, `friendCode`/`claimToken` from `./transfer-codes`, `ValidationError` from `@/lib/attend/events/service`, `supaPost` from `@/lib/supabase`.

- [ ] **Step 2: Verify** — `npx tsc --noEmit`.
- [ ] **Step 3: Commit** — `feat(attend): add the transfer service (Phase 4 task 6)`.

---

## Task 7: Transfer + claim API routes

**Files:**
- Create: `src/app/api/attend/tickets/[id]/transfer/route.ts`, `src/app/api/attend/transfers/[id]/revoke/route.ts`, `src/app/api/attend/transfers/claim/route.ts`

- [ ] **Step 1: `tickets/[id]/transfer/route.ts`** — `POST`. `requireAttendUser` (401 if absent). Body `{ method: 'EMAIL'|'FRIEND_CODE', toEmail?: string }`; validate `method` is one of the two (else 400). `initiateTransfer(params.id, user.id, method, toEmail ?? null, req.nextUrl.origin)` → 200 with its result. Map `ValidationError → 400`, else log + 500.

- [ ] **Step 2: `transfers/[id]/revoke/route.ts`** — `POST`. `requireAttendUser`. `revokeTransfer(params.id, user.id)` → 200 `{ ok: true }`. Same error mapping.

- [ ] **Step 3: `transfers/claim/route.ts`** — `POST`. `requireAttendUser` (401 — the recipient must be signed in). Body `{ token?: string; friendCode?: string }`. `claimTransfer({ claimToken: token, friendCode }, user.id)` → 200 `{ ok: true, eventId }`. Same error mapping.

- [ ] **Step 4: Verify** — `npx tsc --noEmit`; `npm run build` lists the three routes.
- [ ] **Step 5: Commit** — `feat(attend): add the transfer + claim API routes (Phase 4 task 7)`.

---

## Task 8: Wallet transfer UI + claim page

**Files:**
- Create: `src/app/attend/(attendee)/wallet/wallet-ticket.tsx`, `src/app/attend/claim/page.tsx`, `src/app/attend/claim/claim-client.tsx`
- Modify: `src/app/attend/(attendee)/wallet/page.tsx`

- [ ] **Step 1: `wallet-ticket.tsx`** — `'use client'`. Props: one `OwnedTicket`. Renders the tier name + state label (the wallet page's current per-ticket row markup moves here). Behaviour by state:
  - Idle (`ASSIGNED_TO_BUYER` / `TRANSFER_ACCEPTED`): a **Transfer** control — pick Email (an email input) or Friend code; submit → `POST /api/attend/tickets/${ticket.id}/transfer`. On a friend-code response, show the returned code to copy. On success reload.
  - Pending (`TRANSFER_PENDING_*`): show "Transfer pending"; if a `PENDING` row in `attend_ticket_transfers` is friend-code, show the code; a **Revoke** button → `POST /api/attend/transfers/${transferId}/revoke`, reload on success.
  - Other states: state label only.
  - Surface `{ error }` inline; `busy` disables controls.

- [ ] **Step 2: Update `wallet/page.tsx`** — replace the inline per-ticket `<li>` with `<WalletTicket ticket={t} />`. The event-group markup is unchanged.

- [ ] **Step 3: `claim/page.tsx`** at `src/app/attend/claim/page.tsx` (NOT under `(attendee)`) — server component. `export const dynamic = 'force-dynamic'`. Read `searchParams.token`. If present, `getTransferForClaim({ claimToken })` to show the event title + whether the transfer is still claimable. Render `<ClaimClient token={token ?? null} eventTitle={…} />`. No auth gate on the page — an anonymous recipient can see it; the claim *action* requires sign-in. (There is no `(attendee)/layout.tsx`; the wallet gates itself at the page level. Placing claim outside `(attendee)` keeps it gate-free regardless.)

- [ ] **Step 4: `claim-client.tsx`** — `'use client'`. Props `{ token: string | null; eventTitle: string | null }`. If `token`, a "Claim this ticket" button; else a friend-code input + claim button. Submit → `POST /api/attend/transfers/claim` with `{ token }` or `{ friendCode }`. On `401`, prompt the user to sign in (`/attend/login`). On success, redirect to `/attend/wallet`. Show `{ error }` inline.

- [ ] **Step 5: Verify** — `npx tsc --noEmit`; `npm test` green; `npm run build` succeeds and lists `/attend/claim`; no existing route changed.
- [ ] **Step 6: Commit** — `feat(attend): add the wallet transfer UI + claim page (Phase 4 task 8)`.

---

## Verification checklist (whole phase)

- [ ] `npx tsc --noEmit` clean; `npm test` green (incl. new `transfer-codes` tests, updated `wallet-grouping` fixtures); `npm run build` succeeds, lists `/attend/claim` and the three new API routes.
- [ ] Migrations 021–023 applied to Supabase; `attend_claim_transfer` no longer raises "not implemented".
- [ ] Every transfer RPC is atomic (`for update` on the ticket) and ownership is server-enforced — the browser never asserts who owns a ticket.
- [ ] A transfer cannot be initiated on a non-idle ticket or past the event's transfer cutoff; a claim is rejected if expired, revoked, already accepted, or self-claimed.
- [ ] The only shared-file edits are the two modified Attend files; no new dependencies (`resend` already present).

## Notes & deferrals

- **Claim-expiry job is Phase 7.** `expires_at` is written and enforced at claim time; the job that proactively flips a stale `PENDING` transfer to `EXPIRED` is wired with the other §4.6 jobs. A sender can always revoke, so no ticket is stuck.
- The `attend_ticket_transfers.expires_at` window is 7 days from initiation.
- Transfer emails send from the unverified `onboarding@resend.dev` sender (consistent with `/api/report`); switch to a verified `hyveapp.co` sender before a real launch.
