# HYVE Attend — Phase 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay the foundation for the HYVE Attend product inside the `hyve-landing` repo — the full `attend_*` database schema, a test runner, the pure-TypeScript money + fee-calculator core (test-driven), Attend's Supabase-Auth helper, the `/attend` route skeleton, and a HYVE Attend card on the homepage hub.

**Architecture:** HYVE Attend is a new, self-contained product in the existing Next.js 14 App Router app. All code is additive: new files under `src/app/attend/`, `src/app/api/attend/`, `src/lib/attend/`, new `supabase/migrations/008_attend_*.sql`+ files, and one new entry in the homepage `APPS` array. No existing product, route, or shared file is modified except the homepage `APPS` array (the single approved touch). Money-critical writes will use atomic Postgres RPC functions (stubbed here, bodied in later phases); reads use the existing raw-REST Supabase helper.

**Tech Stack:** Next.js 14 (App Router) · TypeScript (strict) · Tailwind · Supabase (Postgres, Auth) · Vitest (new) · `@supabase/ssr` (new).

**Source spec:** `docs/superpowers/specs/2026-05-18-hyve-attend-mvp-design.md` — this plan implements build-order Phase 1 (spec §11.1). Section references below (§N) point at that spec.

**Branch:** `attend-mvp` (already created; the spec doc is committed there).

---

## Conventions for this plan

- **SQL style** — match `supabase/migrations/007_caseline_comp_keys.sql`: lowercase keywords, `create table if not exists`, `create index if not exists`, a brief comment header per file, aligned columns.
- **Applying a migration** — this repo has no Supabase CLI config; migrations are applied by pasting the SQL into the Supabase SQL editor (or via the Supabase MCP `apply_migration` tool). After applying, the `.sql` file is committed so the schema is tracked in git (the spec calls this out — do not leave Attend tables untracked).
- **Imports** — use the `@/` path alias (`@/lib/attend/...`), per `tsconfig.json`.
- **Enum/table prefix** — every Attend Postgres type and table is prefixed `attend_` to stay isolated in the shared database.
- **Commits** — conventional-commit style, matching the repo (`feat(attend): ...`, `chore(attend): ...`). Commit after every task.

## File Structure

Files created in Phase 1, each with one clear responsibility:

| File | Responsibility |
|------|----------------|
| `vitest.config.ts` | Test-runner config (Node environment, `@/` alias) |
| `supabase/migrations/008_attend_enums.sql` | All 16 `attend_*` enum types |
| `supabase/migrations/009_attend_identity.sql` | `attend_profiles`, `attend_artist_profiles`, `attend_payout_accounts` |
| `supabase/migrations/010_attend_events_ticketing.sql` | events, media, ticket types, orders, line items, tickets, transfers |
| `supabase/migrations/011_attend_payments_streaming.sql` | payments, ledger entries, payouts, streams, stream-health metrics |
| `supabase/migrations/012_attend_eventroom_refunds.sql` | attendance, chat, reactions, moderation, refunds, evidence, disputes |
| `supabase/migrations/013_attend_promotion_risk_meta.sql` | promotion, risk, webhook events, audit logs, notifications |
| `supabase/migrations/014_attend_rpc.sql` | The 7 atomic RPC functions, as stubs |
| `src/lib/attend/money.ts` | Integer-cents arithmetic, deterministic rounding, formatting |
| `src/lib/attend/money.test.ts` | Unit tests for the money helper |
| `src/lib/attend/payments/fee-calculator.ts` | The pure fee calculator (§9.1) |
| `src/lib/attend/payments/fee-calculator.test.ts` | Unit tests for the fee calculator (§30, §31) |
| `src/lib/attend/identity/auth.ts` | `getAttendUser()` + `ensureProfile()` over Supabase Auth |
| `src/app/attend/layout.tsx` | Attend shell layout (theme + nav) |
| `src/app/attend/page.tsx` | `/attend` landing placeholder |
| `src/app/page.tsx` | **Modify** — add one HYVE Attend entry to the `APPS` array |

---

## Chunk 1: Scaffolding & data model

### Task 1: Set up the Vitest test runner

The repo has no test runner; Phase 1's money/fee-calculator work is test-driven, so a runner is added first.

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (add `vitest` devDependency + `test` script)
- Create: `src/lib/attend/smoke.test.ts` (temporary, deleted in step 6)

- [ ] **Step 1: Install Vitest**

Run: `npm install -D vitest@^2`
Expected: `vitest` is added to `devDependencies` in `package.json`.

- [ ] **Step 2: Create the Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
})
```

- [ ] **Step 3: Add the `test` script**

In `package.json`, add to `"scripts"`: `"test": "vitest run"` and `"test:watch": "vitest"`.

- [ ] **Step 4: Write a smoke test**

Create `src/lib/attend/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest'

describe('vitest setup', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 5: Run it and verify it passes**

Run: `npm test`
Expected: PASS — 1 test passed.

- [ ] **Step 6: Delete the smoke test and commit**

Delete `src/lib/attend/smoke.test.ts`.

```bash
git add vitest.config.ts package.json package-lock.json
git commit -m "chore(attend): add Vitest test runner"
```

---

### Task 2: Migration 008 — enum types

**Files:**
- Create: `supabase/migrations/008_attend_enums.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/008_attend_enums.sql`. Postgres has no `create type if not exists`, so each type is wrapped in an idempotent block. Enum values are from spec §5.1.

```sql
-- HYVE Attend — enum types. All Attend types are prefixed attend_ to stay
-- isolated in the shared database. Idempotent: re-running is safe.

do $$ begin
  create type attend_role as enum ('USER','CREATOR','MODERATOR','ADMIN','REVIEWER');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attend_show_type as enum
    ('HUMAN_LIVE_BROADCAST','AI_SCHEDULED_PERFORMANCE','HYBRID_HUMAN_AI','PRIVATE_EVENT','FREE_EVENT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attend_event_status as enum
    ('DRAFT','REGISTRATION_PENDING','PROMOTION_FEE_PAID','PAYOUT_SETUP_REQUIRED',
     'STREAM_SETUP_REQUIRED','SUBMITTED_FOR_REVIEW','PUBLISHED','ON_SALE','SALES_PAUSED',
     'SOUNDCHECK','DOORS_OPEN','LIVE','ENDED','SETTLEMENT_HOLD','SETTLED','REFUNDING',
     'CANCELLED','ARCHIVED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attend_ticket_type_kind as enum
    ('GENERAL_ADMISSION','VIP','BACKSTAGE_QA','REPLAY_ACCESS','GROUP_PACK','EARLY_BIRD',
     'PROMO_CODE','COMPLIMENTARY');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attend_ticket_state as enum
    ('HELD_IN_CART','PURCHASED','ASSIGNED_TO_BUYER','TRANSFER_PENDING_EMAIL',
     'TRANSFER_PENDING_FRIEND_CODE','TRANSFER_ACCEPTED','TRANSFER_REVOKED','CHECKED_IN',
     'IN_ROOM','USED','NO_SHOW','REFUND_REQUESTED','REFUNDED','DISPUTED','CANCELLED','EXPIRED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attend_order_status as enum
    ('PENDING','PAID','PARTIALLY_REFUNDED','REFUNDED','CANCELLED','DISPUTED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attend_payment_kind as enum ('TICKET_PURCHASE','REGISTRATION_FEE','REFUND');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attend_payment_status as enum ('PENDING','SUCCEEDED','FAILED','REFUNDED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attend_ledger_entry_type as enum
    ('TICKET_GROSS','HYVE_PLATFORM_FEE','PROCESSOR_FEE_ESTIMATE','TAX_COLLECTED',
     'ARTIST_NET_PENDING','PROMOTION_REGISTRATION_FEE','PROMOTION_BUDGET_ALLOCATED',
     'PROMOTION_SPEND','REFUND_DEBIT','DISPUTE_HOLD','CHARGEBACK_DEBIT','PAYOUT_RELEASED',
     'PAYOUT_FAILED','ADJUSTMENT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attend_payout_status as enum ('PENDING','HELD','RELEASED','FAILED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attend_transfer_method as enum ('EMAIL','FRIEND_CODE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attend_transfer_status as enum ('PENDING','ACCEPTED','REVOKED','EXPIRED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attend_stream_status as enum ('IDLE','TESTING','ACTIVE','DISCONNECTED','ENDED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attend_refund_status as enum
    ('REQUESTED','EVIDENCE_BUILDING','AUTO_RECOMMENDED','NEEDS_HUMAN_REVIEW','APPROVED',
     'DENIED','PROCESSED','CANCELLED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attend_refund_recommendation as enum ('APPROVE','DENY','NEEDS_HUMAN');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attend_dispute_status as enum
    ('NEEDS_RESPONSE','EVIDENCE_BUILDING','EVIDENCE_READY','SUBMITTED','WON','LOST',
     'ACCEPTED','EXPIRED','ESCALATED');
exception when duplicate_object then null; end $$;
```

- [ ] **Step 2: Apply the migration**

Apply `008_attend_enums.sql` in the Supabase SQL editor (or via the Supabase MCP `apply_migration` tool).
Expected: no errors; re-running is a no-op.

- [ ] **Step 3: Verify the types exist**

Run this query in the Supabase SQL editor:
`select typname from pg_type where typname like 'attend_%' order by typname;`
Expected: 16 rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/008_attend_enums.sql
git commit -m "feat(attend): add attend_* enum types (migration 008)"
```

---

### Task 3: Migration 009 — identity tables

**Files:**
- Create: `supabase/migrations/009_attend_identity.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/009_attend_identity.sql` (columns from spec §5.2; `attend_profiles.id` equals the Supabase Auth user id):

```sql
-- HYVE Attend — identity: profiles, artist profiles, payout accounts.
-- attend_profiles.id == auth.users.id (1:1). RLS is enabled to match the
-- repo; access is via the service key and authorized in the service layer.

create table if not exists attend_profiles (
  id            uuid         primary key references auth.users(id) on delete cascade,
  display_name  text         not null,
  email         text         not null,
  role          attend_role  not null default 'USER',
  avatar_url    text,
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now()
);

create table if not exists attend_artist_profiles (
  id          uuid         primary key default gen_random_uuid(),
  profile_id  uuid         not null unique references attend_profiles(id) on delete cascade,
  stage_name  text         not null,
  bio         text,
  avatar_url  text,
  links       jsonb        not null default '{}'::jsonb,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now()
);

create table if not exists attend_payout_accounts (
  id                         uuid         primary key default gen_random_uuid(),
  profile_id                 uuid         not null references attend_profiles(id) on delete cascade,
  stripe_connect_account_id  text         not null unique,
  status                     text         not null default 'ONBOARDING'
                               check (status in ('ONBOARDING','VERIFIED','RESTRICTED','DISABLED')),
  charges_enabled            boolean      not null default false,
  payouts_enabled            boolean      not null default false,
  created_at                 timestamptz  not null default now(),
  updated_at                 timestamptz  not null default now()
);

alter table attend_profiles        enable row level security;
alter table attend_artist_profiles enable row level security;
alter table attend_payout_accounts enable row level security;

create index if not exists idx_attend_artist_profiles_profile on attend_artist_profiles (profile_id);
create index if not exists idx_attend_payout_accounts_profile on attend_payout_accounts (profile_id);
```

- [ ] **Step 2: Apply the migration**

Apply `009_attend_identity.sql` in the Supabase SQL editor.
Expected: 3 tables created, no errors.

- [ ] **Step 3: Verify**

Run: `select table_name from information_schema.tables where table_name like 'attend_%';`
Expected: includes `attend_profiles`, `attend_artist_profiles`, `attend_payout_accounts`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/009_attend_identity.sql
git commit -m "feat(attend): add identity tables (migration 009)"
```

---

### Task 4: Migration 010 — events & ticketing tables

**Files:**
- Create: `supabase/migrations/010_attend_events_ticketing.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/010_attend_events_ticketing.sql` (columns from spec §5.2):

```sql
-- HYVE Attend — events and ticketing. One row per individual ticket
-- (attend_tickets) so every ticket transfers, checks in, and refunds
-- independently. Orders store a frozen policy_snapshot for refund evidence.

create table if not exists attend_events (
  id                    uuid                 primary key default gen_random_uuid(),
  slug                  text                 not null unique,
  creator_id            uuid                 not null references attend_profiles(id),
  title                 text                 not null,
  description           text,
  show_type             attend_show_type     not null,
  status                attend_event_status  not null default 'DRAFT',
  starts_at             timestamptz,
  ends_at               timestamptz,
  timezone              text                 not null default 'UTC',
  visibility            text                 not null default 'PUBLIC' check (visibility in ('PUBLIC','PRIVATE')),
  hero_media_id         uuid,  -- no FK: attend_event_media is created after this table; integrity enforced in the service layer
  refund_cutoff_hours   int                  not null default 24,
  transfer_cutoff_hours int                  not null default 2,
  policy_text           text,
  replay_available      boolean              not null default false,
  created_at            timestamptz          not null default now(),
  updated_at            timestamptz          not null default now(),
  created_by            text,
  updated_by            text,
  deleted_at            timestamptz
);

create table if not exists attend_event_media (
  id            uuid         primary key default gen_random_uuid(),
  event_id      uuid         not null references attend_events(id) on delete cascade,
  kind          text         not null check (kind in ('HERO_IMAGE','HERO_VIDEO','POSTER','GALLERY')),
  storage_path  text         not null,
  position      int          not null default 0,
  created_at    timestamptz  not null default now()
);

create table if not exists attend_ticket_types (
  id             uuid                     primary key default gen_random_uuid(),
  event_id       uuid                     not null references attend_events(id) on delete cascade,
  name           text                     not null,
  kind           attend_ticket_type_kind  not null default 'GENERAL_ADMISSION',
  price_cents    int                      not null check (price_cents >= 0),
  currency       text                     not null default 'usd',
  quantity_total int                      not null check (quantity_total >= 0),
  quantity_sold  int                      not null default 0 check (quantity_sold >= 0),
  max_per_order  int                      not null default 10 check (max_per_order > 0),
  sales_start_at timestamptz,
  sales_end_at   timestamptz,
  status         text                     not null default 'ACTIVE'
                   check (status in ('ACTIVE','PAUSED','SOLD_OUT','HIDDEN')),
  created_at     timestamptz              not null default now(),
  updated_at     timestamptz              not null default now()
);

create table if not exists attend_orders (
  id                        uuid                 primary key default gen_random_uuid(),
  buyer_id                  uuid                 not null references attend_profiles(id),
  event_id                  uuid                 not null references attend_events(id),
  status                    attend_order_status  not null default 'PENDING',
  subtotal_cents            int                  not null default 0,
  hyve_fee_cents            int                  not null default 0,
  processor_fee_cents       int                  not null default 0,
  tax_cents                 int                  not null default 0,
  total_cents               int                  not null default 0,
  currency                  text                 not null default 'usd',
  fee_mode                  text                 not null default 'ABSORB'
                              check (fee_mode in ('ABSORB','PASS_TO_BUYER')),
  policy_snapshot           jsonb                not null default '{}'::jsonb,
  stripe_checkout_session_id text,
  stripe_payment_intent_id   text,
  created_at                timestamptz          not null default now(),
  updated_at                timestamptz          not null default now()
);

create table if not exists attend_order_line_items (
  id              uuid         primary key default gen_random_uuid(),
  order_id        uuid         not null references attend_orders(id) on delete cascade,
  ticket_type_id  uuid         not null references attend_ticket_types(id),
  quantity        int          not null check (quantity > 0),
  unit_price_cents int         not null check (unit_price_cents >= 0),
  created_at      timestamptz  not null default now()
);

create table if not exists attend_tickets (
  id              uuid                 primary key default gen_random_uuid(),
  order_id        uuid                 not null references attend_orders(id),
  event_id        uuid                 not null references attend_events(id),
  ticket_type_id  uuid                 not null references attend_ticket_types(id),
  owner_id        uuid                 references attend_profiles(id),
  access_token    text                 not null unique,
  state           attend_ticket_state  not null default 'HELD_IN_CART',
  checked_in_at   timestamptz,
  created_at      timestamptz          not null default now(),
  updated_at      timestamptz          not null default now()
);

create table if not exists attend_ticket_transfers (
  id              uuid                    primary key default gen_random_uuid(),
  ticket_id       uuid                    not null references attend_tickets(id) on delete cascade,
  from_profile_id uuid                    not null references attend_profiles(id),
  to_email        text,
  to_profile_id   uuid                    references attend_profiles(id),
  method          attend_transfer_method  not null,
  claim_token     text                    unique,
  friend_code     text                    unique,
  status          attend_transfer_status  not null default 'PENDING',
  accepted_at     timestamptz,
  revoked_at      timestamptz,
  expires_at      timestamptz             not null,
  created_at      timestamptz             not null default now()
);

alter table attend_events            enable row level security;
alter table attend_event_media       enable row level security;
alter table attend_ticket_types      enable row level security;
alter table attend_orders            enable row level security;
alter table attend_order_line_items  enable row level security;
alter table attend_tickets           enable row level security;
alter table attend_ticket_transfers  enable row level security;

create index if not exists idx_attend_events_status      on attend_events (status);
create index if not exists idx_attend_events_creator     on attend_events (creator_id);
create index if not exists idx_attend_ticket_types_event on attend_ticket_types (event_id);
create index if not exists idx_attend_orders_buyer       on attend_orders (buyer_id);
create index if not exists idx_attend_orders_event       on attend_orders (event_id);
create index if not exists idx_attend_tickets_owner      on attend_tickets (owner_id);
create index if not exists idx_attend_tickets_event      on attend_tickets (event_id);
create index if not exists idx_attend_transfers_ticket   on attend_ticket_transfers (ticket_id);
```

- [ ] **Step 2: Apply the migration**

Apply `010_attend_events_ticketing.sql` in the Supabase SQL editor.
Expected: 7 tables created, no errors.

- [ ] **Step 3: Verify**

Run: `select count(*) from information_schema.tables where table_name like 'attend_%';`
Expected: 10 (3 from migration 009 + 7 from 010).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/010_attend_events_ticketing.sql
git commit -m "feat(attend): add events and ticketing tables (migration 010)"
```

---

### Task 5: Migration 011 — payments & streaming tables

**Files:**
- Create: `supabase/migrations/011_attend_payments_streaming.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/011_attend_payments_streaming.sql` (columns from spec §5.2; `attend_ledger_entries` is append-only — no `updated_at`, never updated/deleted):

```sql
-- HYVE Attend — payments and streaming. attend_ledger_entries is the
-- append-only money record (spec §16): never updated, never deleted;
-- corrections are new ADJUSTMENT rows. amount_cents is signed.

create table if not exists attend_payments (
  id                        uuid                   primary key default gen_random_uuid(),
  kind                      attend_payment_kind    not null,
  order_id                  uuid                   references attend_orders(id),
  event_id                  uuid                   references attend_events(id),
  profile_id                uuid                   not null references attend_profiles(id),
  amount_cents              int                    not null,
  currency                  text                   not null default 'usd',
  status                    attend_payment_status  not null default 'PENDING',
  stripe_payment_intent_id  text,
  stripe_charge_id          text,
  stripe_refund_id          text,
  created_at                timestamptz            not null default now(),
  updated_at                timestamptz            not null default now()
);

create table if not exists attend_ledger_entries (
  id          uuid                      primary key default gen_random_uuid(),
  event_id    uuid                      references attend_events(id),
  order_id    uuid                      references attend_orders(id),
  payment_id  uuid                      references attend_payments(id),
  ticket_id   uuid                      references attend_tickets(id),
  type        attend_ledger_entry_type  not null,
  amount_cents bigint                   not null,
  currency    text                      not null default 'usd',
  description text                      not null default '',
  source      text                      not null default 'SYSTEM' check (source in ('SYSTEM','HUMAN')),
  created_by  text,
  created_at  timestamptz               not null default now()
);

create table if not exists attend_payouts (
  id                   uuid                  primary key default gen_random_uuid(),
  event_id             uuid                  not null references attend_events(id),
  payout_account_id    uuid                  not null references attend_payout_accounts(id),
  amount_cents         int                   not null,
  currency             text                  not null default 'usd',
  status               attend_payout_status  not null default 'PENDING',
  hold_reason          text,
  scheduled_release_at timestamptz,
  released_at          timestamptz,
  stripe_transfer_id   text,
  created_at           timestamptz           not null default now(),
  updated_at           timestamptz           not null default now()
);

create table if not exists attend_streams (
  id                 uuid                  primary key default gen_random_uuid(),
  event_id           uuid                  not null unique references attend_events(id) on delete cascade,
  provider           text                  not null default 'mux',
  mux_stream_id      text,
  mux_playback_id    text,
  stream_key         text,
  rtmp_url           text,
  status             attend_stream_status  not null default 'IDLE',
  test_passed_at     timestamptz,
  recording_asset_id text,
  started_at         timestamptz,
  ended_at           timestamptz,
  created_at         timestamptz           not null default now(),
  updated_at         timestamptz           not null default now()
);

create table if not exists attend_stream_health_metrics (
  id                  uuid         primary key default gen_random_uuid(),
  stream_id           uuid         not null references attend_streams(id) on delete cascade,
  recorded_at         timestamptz  not null default now(),
  ingest_bitrate      int,
  dropped_frames      int,
  playback_error_count int,
  source              text         not null check (source in ('PROVIDER_WEBHOOK','ATTENDEE_REPORT')),
  metadata            jsonb        not null default '{}'::jsonb,
  created_at          timestamptz  not null default now()
);

alter table attend_payments              enable row level security;
alter table attend_ledger_entries        enable row level security;
alter table attend_payouts                enable row level security;
alter table attend_streams                enable row level security;
alter table attend_stream_health_metrics  enable row level security;

create index if not exists idx_attend_payments_order      on attend_payments (order_id);
create index if not exists idx_attend_ledger_event        on attend_ledger_entries (event_id);
create index if not exists idx_attend_ledger_order        on attend_ledger_entries (order_id);
create index if not exists idx_attend_payouts_event       on attend_payouts (event_id);
create index if not exists idx_attend_stream_health_stream on attend_stream_health_metrics (stream_id);
```

- [ ] **Step 2: Apply the migration**

Apply `011_attend_payments_streaming.sql` in the Supabase SQL editor.
Expected: 5 tables created, no errors.

- [ ] **Step 3: Verify**

Run: `select count(*) from information_schema.tables where table_name like 'attend_%';`
Expected: 15.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/011_attend_payments_streaming.sql
git commit -m "feat(attend): add payments and streaming tables (migration 011)"
```

---

### Task 6: Migration 012 — event room & refunds tables

**Files:**
- Create: `supabase/migrations/012_attend_eventroom_refunds.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/012_attend_eventroom_refunds.sql` (columns from spec §5.2):

```sql
-- HYVE Attend — event room and refunds/disputes. attend_attendance_sessions
-- is the evidence backbone for refund and dispute decisions (spec §17/§18).

create table if not exists attend_attendance_sessions (
  id                   uuid         primary key default gen_random_uuid(),
  ticket_id            uuid         not null references attend_tickets(id),
  profile_id           uuid         not null references attend_profiles(id),
  event_id             uuid         not null references attend_events(id),
  joined_at            timestamptz  not null default now(),
  left_at              timestamptz,
  watch_seconds        int          not null default 0,
  device               text,
  browser              text,
  ip_hash              text,
  playback_error_count int          not null default 0,
  created_at           timestamptz  not null default now()
);

create table if not exists attend_chat_messages (
  id               uuid         primary key default gen_random_uuid(),
  event_id         uuid         not null references attend_events(id) on delete cascade,
  profile_id       uuid         not null references attend_profiles(id),
  body             text         not null,
  moderation_state text         not null default 'VISIBLE'
                     check (moderation_state in ('VISIBLE','HIDDEN','DELETED')),
  created_at       timestamptz  not null default now()
);

create table if not exists attend_reaction_events (
  id          uuid         primary key default gen_random_uuid(),
  event_id    uuid         not null references attend_events(id) on delete cascade,
  profile_id  uuid         not null references attend_profiles(id),
  kind        text         not null,
  created_at  timestamptz  not null default now()
);

create table if not exists attend_moderation_actions (
  id            uuid         primary key default gen_random_uuid(),
  event_id      uuid         not null references attend_events(id) on delete cascade,
  moderator_id  uuid         not null references attend_profiles(id),
  target_type   text         not null check (target_type in ('MESSAGE','USER')),
  target_id     uuid         not null,
  action        text         not null check (action in ('HIDE','MUTE','BAN','UNMUTE')),
  reason        text,
  created_at    timestamptz  not null default now()
);

create table if not exists attend_refund_requests (
  id                uuid                          primary key default gen_random_uuid(),
  ticket_id         uuid                          not null references attend_tickets(id),
  order_id          uuid                          not null references attend_orders(id),
  event_id          uuid                          not null references attend_events(id),
  requester_id      uuid                          not null references attend_profiles(id),
  reason            text,
  status            attend_refund_status          not null default 'REQUESTED',
  recommendation    attend_refund_recommendation,
  evidence_packet_id uuid,  -- no FK: attend_evidence_packets is created after this table; integrity enforced in the service layer
  resolved_by       uuid                          references attend_profiles(id),
  resolved_at       timestamptz,
  created_at        timestamptz                   not null default now(),
  updated_at        timestamptz                   not null default now()
);

create table if not exists attend_evidence_packets (
  id                uuid         primary key default gen_random_uuid(),
  subject_type      text         not null check (subject_type in ('REFUND','DISPUTE')),
  refund_request_id uuid         references attend_refund_requests(id),
  dispute_id        uuid,  -- no FK: attend_disputes is created after this table; integrity enforced in the service layer
  payload           jsonb        not null default '{}'::jsonb,
  score             numeric,
  generated_at      timestamptz  not null default now(),
  created_at        timestamptz  not null default now()
);

create table if not exists attend_disputes (
  id                 uuid                  primary key default gen_random_uuid(),
  payment_id         uuid                  not null references attend_payments(id),
  order_id           uuid                  not null references attend_orders(id),
  event_id           uuid                  not null references attend_events(id),
  stripe_dispute_id  text                  not null unique,
  reason             text,
  amount_cents       int                   not null,
  status             attend_dispute_status not null default 'NEEDS_RESPONSE',
  evidence_packet_id uuid                  references attend_evidence_packets(id),
  due_by             timestamptz,
  created_at         timestamptz           not null default now(),
  updated_at         timestamptz           not null default now()
);

alter table attend_attendance_sessions enable row level security;
alter table attend_chat_messages       enable row level security;
alter table attend_reaction_events     enable row level security;
alter table attend_moderation_actions  enable row level security;
alter table attend_refund_requests     enable row level security;
alter table attend_evidence_packets    enable row level security;
alter table attend_disputes            enable row level security;

create index if not exists idx_attend_attendance_event   on attend_attendance_sessions (event_id);
create index if not exists idx_attend_attendance_ticket  on attend_attendance_sessions (ticket_id);
create index if not exists idx_attend_chat_event         on attend_chat_messages (event_id);
create index if not exists idx_attend_reactions_event    on attend_reaction_events (event_id);
create index if not exists idx_attend_refunds_status     on attend_refund_requests (status);
create index if not exists idx_attend_disputes_status    on attend_disputes (status);
```

- [ ] **Step 2: Apply the migration**

Apply `012_attend_eventroom_refunds.sql` in the Supabase SQL editor.
Expected: 7 tables created, no errors.

- [ ] **Step 3: Verify**

Run: `select count(*) from information_schema.tables where table_name like 'attend_%';`
Expected: 22.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/012_attend_eventroom_refunds.sql
git commit -m "feat(attend): add event room and refunds tables (migration 012)"
```

---

### Task 7: Migration 013 — promotion, risk & cross-cutting tables

**Files:**
- Create: `supabase/migrations/013_attend_promotion_risk_meta.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/013_attend_promotion_risk_meta.sql` (columns from spec §5.2):

```sql
-- HYVE Attend — promotion, risk, and cross-cutting tables.
-- attend_webhook_events deduplicates Stripe/Mux deliveries (spec §10).

create table if not exists attend_promotion_campaigns (
  id           uuid         primary key default gen_random_uuid(),
  event_id     uuid         not null unique references attend_events(id) on delete cascade,
  budget_cents int          not null default 5000,
  status       text         not null default 'ACTIVE'
                 check (status in ('ACTIVE','PAUSED','EXHAUSTED','CLOSED')),
  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now()
);

create table if not exists attend_promotion_spend (
  id           uuid         primary key default gen_random_uuid(),
  campaign_id  uuid         not null references attend_promotion_campaigns(id) on delete cascade,
  kind         text         not null check (kind in ('INTERNAL_PLACEMENT','EXTERNAL')),
  amount_cents int          not null default 0,
  impressions  int          not null default 0,
  clicks       int          not null default 0,
  conversions  int          not null default 0,
  recorded_at  timestamptz  not null default now(),
  created_at   timestamptz  not null default now()
);

create table if not exists attend_risk_scores (
  id           uuid         primary key default gen_random_uuid(),
  subject_type text         not null check (subject_type in ('EVENT','USER')),
  subject_id   uuid         not null,
  score        numeric      not null,
  factors      jsonb        not null default '{}'::jsonb,
  computed_at  timestamptz  not null default now(),
  created_at   timestamptz  not null default now()
);

create table if not exists attend_webhook_events (
  id                uuid         primary key default gen_random_uuid(),
  provider          text         not null check (provider in ('STRIPE','MUX')),
  provider_event_id text         not null unique,
  event_type        text         not null,
  payload           jsonb        not null default '{}'::jsonb,
  processed_at      timestamptz,
  created_at        timestamptz  not null default now()
);

create table if not exists attend_audit_logs (
  id          uuid         primary key default gen_random_uuid(),
  actor_id    uuid,
  actor_type  text         not null default 'SYSTEM' check (actor_type in ('HUMAN','SYSTEM')),
  action      text         not null,
  entity_type text         not null,
  entity_id   uuid,
  metadata    jsonb        not null default '{}'::jsonb,
  ip_hash     text,
  user_agent  text,
  created_at  timestamptz  not null default now()
);

create table if not exists attend_notifications (
  id          uuid         primary key default gen_random_uuid(),
  profile_id  uuid         not null references attend_profiles(id) on delete cascade,
  kind        text         not null,
  payload     jsonb        not null default '{}'::jsonb,
  channels    text[]       not null default '{}',
  read_at     timestamptz,
  created_at  timestamptz  not null default now()
);

alter table attend_promotion_campaigns enable row level security;
alter table attend_promotion_spend     enable row level security;
alter table attend_risk_scores         enable row level security;
alter table attend_webhook_events      enable row level security;
alter table attend_audit_logs          enable row level security;
alter table attend_notifications       enable row level security;

create index if not exists idx_attend_promo_spend_campaign on attend_promotion_spend (campaign_id);
create index if not exists idx_attend_risk_subject         on attend_risk_scores (subject_type, subject_id);
create index if not exists idx_attend_notifications_profile on attend_notifications (profile_id);
```

- [ ] **Step 2: Apply the migration**

Apply `013_attend_promotion_risk_meta.sql` in the Supabase SQL editor.
Expected: 6 tables created, no errors.

- [ ] **Step 3: Verify**

Run: `select count(*) from information_schema.tables where table_name like 'attend_%';`
Expected: 28.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/013_attend_promotion_risk_meta.sql
git commit -m "feat(attend): add promotion, risk and cross-cutting tables (migration 013)"
```

---

### Task 8: Migration 014 — atomic RPC function stubs

The 7 atomic RPC functions (spec §5.3) get real bodies in Phases 2–6. Phase 1 creates them as stubs that raise `not implemented`, so the signatures exist and later phases only replace bodies.

**Files:**
- Create: `supabase/migrations/014_attend_rpc.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/014_attend_rpc.sql`. Each function takes a single `jsonb` argument (`p_args`) — the TypeScript caller computes everything and passes a validated payload; the function body (added later) performs the atomic persist.

```sql
-- HYVE Attend — atomic RPC function stubs (spec §5.3). Each money-critical
-- multi-table write is one function so its body runs in a single implicit
-- transaction. Bodies are filled in Phases 2-6; these stubs only fix the
-- signatures. Each takes one jsonb payload computed by the TypeScript caller.

create or replace function attend_create_pending_order(p_args jsonb)
returns jsonb language plpgsql as $$
begin
  raise exception 'attend_create_pending_order not implemented (Phase 3)';
end $$;

create or replace function attend_complete_checkout(p_args jsonb)
returns jsonb language plpgsql as $$
begin
  raise exception 'attend_complete_checkout not implemented (Phase 3)';
end $$;

create or replace function attend_pay_registration(p_args jsonb)
returns jsonb language plpgsql as $$
begin
  raise exception 'attend_pay_registration not implemented (Phase 2)';
end $$;

create or replace function attend_claim_transfer(p_args jsonb)
returns jsonb language plpgsql as $$
begin
  raise exception 'attend_claim_transfer not implemented (Phase 4)';
end $$;

create or replace function attend_process_refund(p_args jsonb)
returns jsonb language plpgsql as $$
begin
  raise exception 'attend_process_refund not implemented (Phase 6)';
end $$;

create or replace function attend_release_payout(p_args jsonb)
returns jsonb language plpgsql as $$
begin
  raise exception 'attend_release_payout not implemented (Phase 6)';
end $$;

create or replace function attend_cancel_event_refunds(p_args jsonb)
returns jsonb language plpgsql as $$
begin
  raise exception 'attend_cancel_event_refunds not implemented (Phase 6)';
end $$;
```

- [ ] **Step 2: Apply the migration**

Apply `014_attend_rpc.sql` in the Supabase SQL editor.
Expected: 7 functions created, no errors.

- [ ] **Step 3: Verify**

Run: `select proname from pg_proc where proname like 'attend_%';`
Expected: 7 rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/014_attend_rpc.sql
git commit -m "feat(attend): add atomic RPC function stubs (migration 014)"
```

---

## Chunk 2: Foundation code

### Task 9: The money helper (test-driven)

A pure module for integer-cents arithmetic. No floats anywhere (spec §5 money convention). `percentOf` uses deterministic round-half-up.

**Files:**
- Create: `src/lib/attend/money.ts`
- Test: `src/lib/attend/money.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/attend/money.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { percentOf, formatUsd, sumCents } from '@/lib/attend/money'

describe('percentOf', () => {
  it('takes a basis-point percentage of an integer-cent amount', () => {
    expect(percentOf(10_000, 2.5)).toBe(250)   // 2.5% of $100.00 = $2.50
    expect(percentOf(2_500, 2.5)).toBe(63)     // 2.5% of $25.00 = 62.5c -> 63 (round half up)
    expect(percentOf(2_500, 5.5)).toBe(138)    // 5.5% of $25.00 = 137.5c -> 138
    expect(percentOf(0, 2.5)).toBe(0)
  })

  it('rounds half up deterministically', () => {
    expect(percentOf(2_100, 2.5)).toBe(53)     // 52.5 -> 53
    expect(percentOf(2_020, 2.5)).toBe(51)     // 50.5 -> 51
  })

  it('rejects non-integer cent input', () => {
    expect(() => percentOf(100.5, 2.5)).toThrow()
  })
})

describe('sumCents', () => {
  it('adds integer-cent amounts', () => {
    expect(sumCents([100, 250, 30])).toBe(380)
    expect(sumCents([])).toBe(0)
  })
})

describe('formatUsd', () => {
  it('formats integer cents as a USD string', () => {
    expect(formatUsd(2_500)).toBe('$25.00')
    expect(formatUsd(0)).toBe('$0.00')
    expect(formatUsd(99)).toBe('$0.99')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/attend/money.test.ts`
Expected: FAIL — cannot resolve `@/lib/attend/money`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/attend/money.ts`:

```ts
// Integer-cents money helper for HYVE Attend. All amounts are integer
// cents; no floating-point money math anywhere (spec §5 money convention).

function assertIntCents(cents: number): void {
  if (!Number.isInteger(cents)) {
    throw new Error(`money: expected integer cents, got ${cents}`)
  }
}

/**
 * Take `percent` percent of an integer-cent amount, rounding half up.
 * `percent` is a human percentage (2.5 means 2.5%), not a fraction.
 */
export function percentOf(cents: number, percent: number): number {
  assertIntCents(cents)
  // Scale to avoid floating error: (cents * percent * 10) / 1000, round half up.
  const scaled = cents * percent * 10
  return Math.floor((scaled + 500) / 1000)
}

/** Sum a list of integer-cent amounts. */
export function sumCents(amounts: number[]): number {
  let total = 0
  for (const a of amounts) {
    assertIntCents(a)
    total += a
  }
  return total
}

/** Format integer cents as a USD string, e.g. 2500 -> "$25.00". */
export function formatUsd(cents: number): string {
  assertIntCents(cents)
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/attend/money.test.ts`
Expected: PASS — all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/attend/money.ts src/lib/attend/money.test.ts
git commit -m "feat(attend): add integer-cents money helper"
```

---

### Task 10: The fee calculator (test-driven)

The single source of pricing truth (spec §9.1) — pure, no DB, no Stripe. HYVE platform fee is 2.5% for human shows, 5.5% for AI; processor estimate is Stripe US card (2.9% + 30¢); registration fee is 5000¢ per paid show.

**Files:**
- Create: `src/lib/attend/payments/fee-calculator.ts`
- Test: `src/lib/attend/payments/fee-calculator.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/attend/payments/fee-calculator.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { calculateFees } from '@/lib/attend/payments/fee-calculator'

describe('calculateFees — human show', () => {
  it('computes a $25 human ticket all-in (ABSORB mode)', () => {
    const r = calculateFees({
      showType: 'HUMAN_LIVE_BROADCAST',
      ticketSubtotalCents: 2_500,
      quantity: 1,
      feeMode: 'ABSORB',
      taxEstimateCents: 0,
      discountsCents: 0,
      currency: 'usd',
    })
    expect(r.ticketSubtotalCents).toBe(2_500)
    expect(r.hyvePlatformFeeCents).toBe(63)      // 2.5% of 2500, round half up
    expect(r.processorFeeCents).toBe(103)        // 2.9% of 2500 + 30
    expect(r.buyerTotalCents).toBe(2_500)        // ABSORB: buyer pays subtotal only
    expect(r.artistGrossCents).toBe(2_500)
    expect(r.artistNetEstimateCents).toBe(2_334) // 2500 - 63 - 103
  })

  it('PASS_TO_BUYER adds fees on top of the subtotal', () => {
    const r = calculateFees({
      showType: 'HUMAN_LIVE_BROADCAST',
      ticketSubtotalCents: 2_500,
      quantity: 1,
      feeMode: 'PASS_TO_BUYER',
      taxEstimateCents: 0,
      discountsCents: 0,
      currency: 'usd',
    })
    expect(r.buyerTotalCents).toBe(2_666)        // 2500 + 63 + 103
    expect(r.artistNetEstimateCents).toBe(2_500) // artist keeps the full subtotal
  })
})

describe('calculateFees — AI show', () => {
  it('uses the 5.5% platform fee', () => {
    const r = calculateFees({
      showType: 'AI_SCHEDULED_PERFORMANCE',
      ticketSubtotalCents: 2_500,
      quantity: 1,
      feeMode: 'ABSORB',
      taxEstimateCents: 0,
      discountsCents: 0,
      currency: 'usd',
    })
    expect(r.hyvePlatformFeeCents).toBe(138)     // 5.5% of 2500
  })
})

describe('calculateFees — registration fee', () => {
  it('is 5000c for a paid show and 0 for a free show', () => {
    const paid = calculateFees({
      showType: 'HUMAN_LIVE_BROADCAST', ticketSubtotalCents: 2_500, quantity: 1,
      feeMode: 'ABSORB', taxEstimateCents: 0, discountsCents: 0, currency: 'usd',
    })
    expect(paid.promotionRegistrationFeeCents).toBe(5_000)

    const free = calculateFees({
      showType: 'FREE_EVENT', ticketSubtotalCents: 0, quantity: 1,
      feeMode: 'ABSORB', taxEstimateCents: 0, discountsCents: 0, currency: 'usd',
    })
    expect(free.promotionRegistrationFeeCents).toBe(0)
  })
})

describe('calculateFees — tax and discounts', () => {
  it('adds tax to the buyer total and subtracts discounts from the subtotal', () => {
    const r = calculateFees({
      showType: 'HUMAN_LIVE_BROADCAST',
      ticketSubtotalCents: 5_000,
      quantity: 2,
      feeMode: 'ABSORB',
      taxEstimateCents: 200,
      discountsCents: 500,
      currency: 'usd',
    })
    expect(r.ticketSubtotalCents).toBe(4_500)    // 5000 - 500 discount
    expect(r.taxCents).toBe(200)
    expect(r.buyerTotalCents).toBe(4_700)        // 4500 + 200 tax (ABSORB)
  })
})

describe('calculateFees — processor fee override', () => {
  it('uses a supplied processorFeeEstimateCents instead of the computed estimate', () => {
    const r = calculateFees({
      showType: 'HUMAN_LIVE_BROADCAST',
      ticketSubtotalCents: 2_500,
      quantity: 1,
      feeMode: 'PASS_TO_BUYER',
      processorFeeEstimateCents: 120,
      taxEstimateCents: 0,
      discountsCents: 0,
      currency: 'usd',
    })
    expect(r.processorFeeCents).toBe(120)
    expect(r.buyerTotalCents).toBe(2_683)        // 2500 + 63 hyve + 120 processor
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/attend/payments/fee-calculator.test.ts`
Expected: FAIL — cannot resolve `@/lib/attend/payments/fee-calculator`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/attend/payments/fee-calculator.ts`:

```ts
// The HYVE Attend fee calculator (spec §9.1, §30) — the single source of
// pricing truth. Pure: no database, no Stripe. Integer cents only.

import { percentOf } from '@/lib/attend/money'

export type ShowType =
  | 'HUMAN_LIVE_BROADCAST'
  | 'AI_SCHEDULED_PERFORMANCE'
  | 'HYBRID_HUMAN_AI'
  | 'PRIVATE_EVENT'
  | 'FREE_EVENT'

export type FeeMode = 'ABSORB' | 'PASS_TO_BUYER'

export interface FeeInput {
  showType: ShowType
  ticketSubtotalCents: number
  /** Reserved — callers pass an already-summed subtotal; unused in Phase 1. */
  quantity: number
  feeMode: FeeMode
  /**
   * Optional: a known/real processor fee (e.g. from a Stripe balance
   * transaction during post-charge reconciliation). When omitted, the
   * Stripe US-card estimate (2.9% + 30c) is computed.
   */
  processorFeeEstimateCents?: number
  taxEstimateCents: number
  discountsCents: number
  currency: string
}

export interface FeeBreakdown {
  ticketSubtotalCents: number
  hyvePlatformFeeCents: number
  processorFeeCents: number
  taxCents: number
  buyerTotalCents: number
  artistGrossCents: number
  artistNetEstimateCents: number
  promotionRegistrationFeeCents: number
}

const HYVE_FEE_PERCENT: Record<ShowType, number> = {
  HUMAN_LIVE_BROADCAST: 2.5,
  PRIVATE_EVENT: 2.5,
  FREE_EVENT: 2.5,
  HYBRID_HUMAN_AI: 5.5,
  AI_SCHEDULED_PERFORMANCE: 5.5,
}

const STRIPE_PERCENT = 2.9
const STRIPE_FIXED_CENTS = 30
const REGISTRATION_FEE_CENTS = 5_000

export function calculateFees(input: FeeInput): FeeBreakdown {
  const subtotal = Math.max(0, input.ticketSubtotalCents - input.discountsCents)

  const hyvePlatformFeeCents = percentOf(subtotal, HYVE_FEE_PERCENT[input.showType])
  const processorFeeCents =
    input.processorFeeEstimateCents ??
    (subtotal > 0 ? percentOf(subtotal, STRIPE_PERCENT) + STRIPE_FIXED_CENTS : 0)
  const taxCents = input.taxEstimateCents

  // ABSORB: the artist absorbs fees, the buyer pays the ticket subtotal (+ tax).
  // PASS_TO_BUYER: fees are added on top of the subtotal.
  const buyerTotalCents =
    input.feeMode === 'ABSORB'
      ? subtotal + taxCents
      : subtotal + hyvePlatformFeeCents + processorFeeCents + taxCents

  const artistGrossCents = subtotal
  const artistNetEstimateCents =
    input.feeMode === 'ABSORB'
      ? subtotal - hyvePlatformFeeCents - processorFeeCents
      : subtotal

  const isPaid = subtotal > 0
  const promotionRegistrationFeeCents = isPaid ? REGISTRATION_FEE_CENTS : 0

  return {
    ticketSubtotalCents: subtotal,
    hyvePlatformFeeCents,
    processorFeeCents,
    taxCents,
    buyerTotalCents,
    artistGrossCents,
    artistNetEstimateCents,
    promotionRegistrationFeeCents,
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/attend/payments/fee-calculator.test.ts`
Expected: PASS — all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/attend/payments/fee-calculator.ts src/lib/attend/payments/fee-calculator.test.ts
git commit -m "feat(attend): add the fee calculator"
```

---

### Task 11: Attend Supabase-Auth helper

Attend uses Supabase Auth for end-user accounts. `getAttendUser()` reads the signed-in Supabase user server-side; `ensureProfile()` lazily creates the `attend_profiles` row on first Attend use (so Spy-only users never get an Attend profile).

**Files:**
- Modify: `package.json` (add `@supabase/ssr`, `@supabase/supabase-js`)
- Create: `src/lib/attend/identity/auth.ts`

- [ ] **Step 1: Install the Supabase SSR packages**

Run: `npm install @supabase/ssr @supabase/supabase-js`
Expected: both added to `dependencies`.

- [ ] **Step 2: Write the auth helper**

Create `src/lib/attend/identity/auth.ts`:

```ts
// HYVE Attend auth — reads the Supabase Auth session server-side and
// lazily provisions an attend_profiles row. Attend-only: it does not
// touch Spy/CaseLine auth.

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { supaGet, supaPost } from '@/lib/supabase'

export interface AttendUser {
  id: string
  email: string
}

/** The signed-in Supabase user, or null if not authenticated. */
export async function getAttendUser(): Promise<AttendUser | null> {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {
          /* read-only in Server Components; session refresh handled at route level */
        },
      },
    },
  )
  const { data } = await supabase.auth.getUser()
  if (!data.user || !data.user.email) return null
  return { id: data.user.id, email: data.user.email }
}

/**
 * Ensure an attend_profiles row exists for this user. Idempotent — safe to
 * call on every authenticated Attend request. Returns the profile id.
 */
export async function ensureProfile(user: AttendUser): Promise<string> {
  const res = await supaGet('attend_profiles', `id=eq.${user.id}&select=id`)
  const rows = (await res.json()) as { id: string }[]
  if (rows.length > 0) return rows[0].id

  await supaPost(
    'attend_profiles',
    {
      id: user.id,
      email: user.email,
      display_name: user.email.split('@')[0],
      role: 'USER',
    },
    'return=minimal',
  )
  return user.id
}
```

- [ ] **Step 3: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors in `src/lib/attend/identity/auth.ts`.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/attend/identity/auth.ts
git commit -m "feat(attend): add Supabase-Auth helper and lazy profile provisioning"
```

---

### Task 12: The `/attend` route skeleton

A shell layout and a landing placeholder so `/attend` resolves. The layout owns Attend's theme and is where later phases add auth gating — `src/middleware.ts` is never touched.

**Files:**
- Create: `src/app/attend/layout.tsx`
- Create: `src/app/attend/page.tsx`

- [ ] **Step 1: Write the Attend layout**

Create `src/app/attend/layout.tsx`:

```tsx
// HYVE Attend shell layout. Owns the Attend product's chrome. Auth gating
// for nested segments (creator, attendee, admin) is added in later phases
// here and in nested layouts — never in the shared src/middleware.ts.

import Link from 'next/link'

export const metadata = {
  title: 'HYVE Attend — Live events, browser-first',
  description:
    'Discover and attend live performances. Buy tickets, transfer them, and join the show from your browser.',
}

export default function AttendLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#08070a] font-sans text-[#ede8d8]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Link href="/attend" className="text-sm font-black tracking-[0.3em] text-[#E8C456]">
          HYVE ATTEND
        </Link>
        <nav className="flex gap-5 text-xs font-bold tracking-[0.2em] text-[#9e8a55]">
          <Link href="/attend" className="hover:text-[#E8C456]">DISCOVER</Link>
          <Link href="/attend/wallet" className="hover:text-[#E8C456]">WALLET</Link>
          <Link href="/attend/creator" className="hover:text-[#E8C456]">CREATE</Link>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-6 pb-24">{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Write the `/attend` landing placeholder**

Create `src/app/attend/page.tsx`:

```tsx
// /attend landing placeholder. Event discovery is built in Phase 3 (spec §7).

export default function AttendHome() {
  return (
    <section className="py-20 text-center">
      <h1 className="text-4xl font-black md:text-5xl">Live events, browser-first.</h1>
      <p className="mx-auto mt-4 max-w-xl text-sm text-[#9e8a55]">
        HYVE Attend is coming online. Discover live performances, buy and transfer
        tickets, and join the show from any browser.
      </p>
    </section>
  )
}
```

- [ ] **Step 3: Verify the route builds and renders**

Run: `npm run build`
Expected: build succeeds; output lists the `/attend` route.

Then run `npm run dev`, open `http://localhost:3000/attend`, and confirm the placeholder page renders with the Attend header.

- [ ] **Step 4: Commit**

```bash
git add src/app/attend/layout.tsx src/app/attend/page.tsx
git commit -m "feat(attend): add /attend route skeleton and shell layout"
```

---

### Task 13: Add the HYVE Attend homepage hub card

The single approved modification to an existing file: one entry in the homepage `APPS` array so HYVE Attend is discoverable alongside Spy and CaseLine.

**Files:**
- Modify: `src/app/page.tsx` (the `APPS` array, currently ending after the `Hyve CaseLine` entry around line 102)

- [ ] **Step 1: Add the APPS entry**

In `src/app/page.tsx`, add this object as the last element of the `APPS` array (after the `Hyve CaseLine` entry, before the closing `]`):

```tsx
  {
    name: 'HYVE Attend',
    tagline: 'Live events — browser-first ticketing & broadcast',
    href: '/attend',
    icon: '🎟️',
    accent: '#E8C456',
    blurb:
      'Discover live performances, buy and transfer tickets, and join the show from any browser. Low-fee ticketing, an interactive event room, automated refunds and payouts — for human live broadcasts today, AI performances next.',
    badge: 'NEW',
  },
```

This only adds an array element — it changes no existing entry and no existing feature.

- [ ] **Step 2: Verify the homepage builds and shows the card**

Run: `npm run build`
Expected: build succeeds.

Then run `npm run dev`, open `http://localhost:3000`, and confirm a "HYVE Attend" card appears in the apps grid with a `NEW` badge and links to `/attend`.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(attend): add HYVE Attend card to the homepage hub"
```

---

## Phase 1 completion check

Phase 1 is complete when:
- `npm test` passes (money helper + fee calculator).
- `npm run build` succeeds with the `/attend` route present.
- All 16 `attend_*` enum types, 28 `attend_*` tables, and 7 `attend_*` RPC functions exist in Supabase, and migrations `008`–`014` are committed.
- The homepage shows a HYVE Attend card linking to `/attend`.
- No file outside the `attend_*` / `src/app/attend` / `src/lib/attend` namespace was modified except the one `APPS`-array addition in `src/app/page.tsx`, the new `vitest.config.ts`, and the `package.json` dependency additions.

**Next:** Phase 2 — Creator flow (event CRUD, the lifecycle state machine, ticket types, the $50 registration charge, Stripe Connect onboarding, the creator dashboard). It gets its own plan.
