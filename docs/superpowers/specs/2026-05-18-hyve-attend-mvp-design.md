# HYVE Attend — MVP Design Specification

**Date:** 2026-05-18
**Status:** Approved — spec review passed; ready for implementation planning
**Product spec (source of truth):** HYVE Attend Build Bible — `C:\Users\PTMaj\Desktop\Nwsbot\HYVE_ATTEND_BUILD_BIBLE.md`
**Target repository:** `hyve-landing` — the Next.js 14 app behind www.hyveapp.co

---

## 1. Overview

HYVE Attend is a live-events ticketing and broadcast platform. Creators register live shows, sell tickets, and broadcast to ticket-holders in an interactive browser/mobile event room. The platform automates platform fees, artist payouts, refunds, disputes/chargebacks, and a per-show promotion budget.

HYVE Attend is built as a **new, self-contained product inside the existing `hyve-landing` repository** — the multi-product umbrella that already hosts Hyve Spy and Hyve CaseLine. It occupies the `/attend` route subtree and follows the established per-product pattern. It adds new files only; it does **not** modify any existing product, route, the shared `/admin`, the shared Stripe webhook, or `src/middleware.ts`. The single approved exception is one product card added to the homepage hub.

This document specifies the **MVP**: build bible §27 acceptance criteria plus a basic promotion-budget ledger — the build bible's Phases 0–5.

## 2. Scope

### 2.1 In scope
- **Creator:** Supabase-Auth account, Stripe Connect Express payout onboarding, event creation, ticket types, the $50 registration/promotion fee, Mux Live stream setup + test, submit/publish, creator dashboard.
- **Event lifecycle** state machine (§6.9).
- **Buyer:** event discovery, event page with all-in pricing, multi-ticket checkout via Stripe, ticket wallet.
- **Ticket lifecycle** state machine (§7.9).
- **Ledger** (§16) and the centralized **fee calculator** (§30).
- **Ticket transfers** by email and by friend code; claim and revoke.
- **Live event room:** Mux Live HLS playback, realtime chat + reactions, attendance logging, stream-health metrics, basic moderation.
- **Refunds:** requests, automated evidence packets, automated recommendation rules, admin review, Stripe refund execution.
- **Disputes:** Stripe chargeback ingestion, evidence packets, admin handling.
- **Payouts:** ledger-computed artist net, hold + automated release.
- **Risk:** basic rule-based scoring of events and users.
- **Back office:** an Attend-internal `/attend/admin` with review queues.
- **Discovery:** one HYVE Attend card on the hyveapp.co homepage hub.

### 2.2 Out of scope (deferred)
- AI scheduled performances and hybrid shows (Phase 7) — `show_type` carries the enum values; no AI flow is built.
- VR (Phase 8).
- Event-room polls and Q&A queue — the MVP room ships chat + reactions only.
- External ad-platform integrations and promotion-spend import (Phase 6 beyond the basic budget ledger).
- Unified cross-product HYVE accounts.
- Household/group watch mode.
- Promo-code discounts and admin-issued complimentary tickets (the enum values exist; no MVP flow issues or discounts them).

### 2.3 Show types implemented
`HUMAN_LIVE_BROADCAST`, `FREE_EVENT`, `PRIVATE_EVENT`. `AI_SCHEDULED_PERFORMANCE` and `HYBRID_HUMAN_AI` exist as enum values only; no AI flow is built. `PRIVATE_EVENT` additionally sets `attend_events.visibility = PRIVATE`.

**Ticket-type kinds are display labels only in the MVP** — `attend_ticket_types` carries a `kind`, but no flow applies kind-specific behavior. Every ticket type is priced and quantity-limited the same way regardless of kind.

## 3. Key decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Design the whole MVP as one spec | User chose comprehensive upfront design over a phased start |
| 2 | Build inside `hyve-landing` as the `/attend` product | The repo is a multi-product umbrella; mirrors the `/spy`, `/caseline` pattern |
| 3 | Stack: Next.js 14 App Router + TypeScript + Tailwind + Supabase + Stripe + Mux | Already the repo's stack |
| 4 | Real Mux Live streaming | Genuine RTMP ingest + HLS + stream-health webhooks, not a placeholder |
| 5 | Real Stripe Connect, test mode | Real checkout + payouts using Stripe test keys |
| 6 | Modular monolith | Domain modules in one deployable, communicating via typed interfaces |
| 7 | Money-critical writes via atomic Postgres RPC functions | PostgREST cannot wrap multiple REST calls in a transaction; RPC gives atomicity while staying repo-consistent |
| 8 | Fully additive — new files only, no changes to other products | Explicit user constraint |
| 9 | One homepage hub card for discovery | The single approved additive touch to an existing file |

## 4. Architecture

### 4.1 Runtime
One Next.js 14 (App Router) application — the existing `hyve-landing` deployment on Vercel — talking to Supabase (Postgres, Auth, Storage, Realtime), Stripe, and Mux. No new service or deployment is introduced.

### 4.2 Layers (each layer calls only downward)
- **UI** — React Server Components for data display, Client Components for interactivity, under `src/app/attend/`.
- **Entry points** — Server Actions, route handlers under `src/app/api/attend/`, webhook handlers, and job handlers. All thin: authenticate, validate input, call a service, shape the response.
- **Domain services** — all business logic, in `src/lib/attend/<module>/`. Plain, unit-testable TypeScript.
- **Data access** — the existing raw-REST Supabase helper (`src/lib/supabase.ts`) for reads and simple writes; **atomic Postgres RPC functions** for money-critical multi-table writes.
- **Integrations** — `PaymentProvider` (Stripe) and `StreamProvider` (Mux) interfaces, each with a real implementation and a fake implementation for local dev and CI.

### 4.3 Modules (`src/lib/attend/<module>/`)

| Module | Owns |
|--------|------|
| `identity` | Attend profiles, roles, artist profiles, payout-account linkage |
| `events` | Event records, the lifecycle state machine, schedules, policies |
| `ticketing` | Ticket types, orders, tickets, the ticket state machine, transfers, friend codes |
| `payments` | Stripe integration, the ledger, the fee calculator, payouts |
| `streaming` | Mux streams, signed playback tokens, stream-health metrics |
| `eventroom` | Room sessions, attendance, chat, reactions, moderation |
| `refunds` | Refund requests, evidence packets, dispute records |
| `promotion` | The $50 registration fee and the `promotion_budget` ledger |
| `risk` | Event/user risk scoring, read by `events`, `payments`, `refunds` |

Dependency direction: `identity` and `payments` are foundational (they import nothing from higher modules); `refunds` and `risk` sit on top and read from many. Modules communicate **only** through typed service interfaces — no module reaches into another module's tables.

### 4.4 Folder layout (all new files)
```
src/
  app/
    attend/
      (public)/        discovery, event pages, ticket claim
      (attendee)/      wallet, event room, refund requests
      (creator)/       creator dashboard
      admin/           Attend-internal review queues
      layout.tsx       Attend shell + auth gating (NOT shared middleware)
    api/attend/
      webhooks/{stripe,mux}/
      jobs/            one handler per job in §4.6
      ...resource endpoints
  lib/attend/
    identity/ events/ ticketing/ payments/
    streaming/ eventroom/ refunds/ promotion/ risk/
      # each: service.ts, repository.ts, types.ts, *.test.ts
    money.ts
    integrations/
      payments/{stripe,fake}.ts
      streaming/{mux,fake}.ts
supabase/migrations/    008_attend_*.sql onward (new files)
.github/workflows/      attend-jobs-*.yml (new files)
```

### 4.5 Integration boundaries
- **`PaymentProvider`** (Stripe Connect) — create Checkout sessions, create/inspect Connect Express accounts, create Transfers, issue refunds, verify webhook signatures, submit dispute evidence. The fake implementation simulates these deterministically for dev/CI.
- **`StreamProvider`** (Mux Live) — create a live stream (RTMP ingest URL + key + playback ID), mint signed playback tokens, verify webhook signatures, resolve recording assets. The fake implementation simulates these for dev/CI.
- **Webhooks** — `/api/attend/webhooks/stripe` and `/api/attend/webhooks/mux`, both Attend-owned, separate from the existing `/api/stripe/webhook`.

### 4.6 Background jobs
GitHub Actions scheduled workflows call protected `/api/attend/jobs/<name>` endpoints, authenticated with a shared secret (`ATTEND_JOB_SECRET`). The Vercel Hobby plan caps crons at 3 and the repo already uses all 3, so Attend follows the repo's existing GitHub-Actions-driven job pattern. Every job handler is idempotent. The complete MVP job set:

| Job | Purpose |
|-----|---------|
| `cart-expiry` | Cancel `PENDING` orders past their Stripe-session expiry; set held tickets `EXPIRED`; restore availability |
| `claim-expiry` | Expire unredeemed ticket transfers past `expires_at` |
| `countdown-notifications` | Hourly: notify ticket-holders of events ~24h and ~1h before `starts_at` |
| `stream-health` | Poll stream health and persist `attend_stream_health_metrics` |
| `attendance-finalize` | After an event ends: close any still-open `attend_attendance_sessions` (including attendees left `IN_ROOM`), set each ticket `USED`/`NO_SHOW`, and force `LIVE → ENDED` for events past `ends_at` + grace with no end signal |
| `refund-evidence` | Build evidence packets for new refund requests |
| `dispute-evidence` | Build evidence packets for new disputes ahead of the deadline |
| `payout-release` | Release payouts whose hold has cleared (§9.4) |
| `settlement` | Move events `SETTLEMENT_HOLD → SETTLED` once payouts resolve (§9.4) |
| `replay-processing` | Mark `attend_events.replay_available` when a Mux recording asset is ready |

## 5. Data model

All HYVE Attend tables are prefixed `attend_` and shipped as **checked-in** numbered migrations (`supabase/migrations/008_attend_*.sql` onward). RLS is enabled on every table (consistent with the repo); database access uses the Supabase service key and authorization is enforced in the service layer.

**Audit convention (applies to every table):** `id uuid` primary key, `created_at timestamptz`, `updated_at timestamptz`. Mutable/sensitive tables additionally carry `created_by`, `updated_by` (a profile id or the literal `'system'`) and `deleted_at` (soft delete). Sensitive actions additionally write an `attend_audit_logs` row. Exception: `attend_ledger_entries` is append-only — it has `created_at`/`created_by` but no `updated_at` and is never updated or deleted.

**Money convention:** all monetary amounts are integer cents. No floating-point arithmetic anywhere. A `src/lib/attend/money.ts` helper owns arithmetic, deterministic rounding (round-half-up), and formatting.

### 5.1 Enums

- `attend_role`: `USER`, `CREATOR`, `MODERATOR`, `ADMIN`, `REVIEWER`
- `show_type`: `HUMAN_LIVE_BROADCAST`, `AI_SCHEDULED_PERFORMANCE`, `HYBRID_HUMAN_AI`, `PRIVATE_EVENT`, `FREE_EVENT`
- `event_status`: `DRAFT`, `REGISTRATION_PENDING`, `PROMOTION_FEE_PAID`, `PAYOUT_SETUP_REQUIRED`, `STREAM_SETUP_REQUIRED`, `SUBMITTED_FOR_REVIEW`, `PUBLISHED`, `ON_SALE`, `SALES_PAUSED`, `SOUNDCHECK`, `DOORS_OPEN`, `LIVE`, `ENDED`, `SETTLEMENT_HOLD`, `SETTLED`, `REFUNDING`, `CANCELLED`, `ARCHIVED`
  - Build bible §11 also lists `REPLAY_AVAILABLE`; that is modelled here as a separate `attend_events.replay_available` boolean, not a `status` value, because replay readiness is orthogonal to the financial-settlement track.
- `ticket_type_kind`: `GENERAL_ADMISSION`, `VIP`, `BACKSTAGE_QA`, `REPLAY_ACCESS`, `GROUP_PACK`, `EARLY_BIRD`, `PROMO_CODE`, `COMPLIMENTARY` (display labels only in the MVP — see §2.3)
- `ticket_state`: `HELD_IN_CART`, `PURCHASED`, `ASSIGNED_TO_BUYER`, `TRANSFER_PENDING_EMAIL`, `TRANSFER_PENDING_FRIEND_CODE`, `TRANSFER_ACCEPTED`, `TRANSFER_REVOKED`, `CHECKED_IN`, `IN_ROOM`, `USED`, `NO_SHOW`, `REFUND_REQUESTED`, `REFUNDED`, `DISPUTED`, `CANCELLED`, `EXPIRED` — the authoritative transitions are in §7.9. `PURCHASED` and `TRANSFER_REVOKED` are enum-reserved: the MVP assigns tickets straight to `ASSIGNED_TO_BUYER` at checkout completion, and a revoked transfer is recorded on `attend_ticket_transfers.status`, so no MVP flow sets those two ticket states.
- `order_status`: `PENDING`, `PAID`, `PARTIALLY_REFUNDED`, `REFUNDED`, `CANCELLED`, `DISPUTED`
- `payment_kind`: `TICKET_PURCHASE`, `REGISTRATION_FEE`, `REFUND`
- `payment_status`: `PENDING`, `SUCCEEDED`, `FAILED`, `REFUNDED`
- `ledger_entry_type`: `TICKET_GROSS`, `HYVE_PLATFORM_FEE`, `PROCESSOR_FEE_ESTIMATE`, `TAX_COLLECTED`, `ARTIST_NET_PENDING`, `PROMOTION_REGISTRATION_FEE`, `PROMOTION_BUDGET_ALLOCATED`, `PROMOTION_SPEND`, `REFUND_DEBIT`, `DISPUTE_HOLD`, `CHARGEBACK_DEBIT`, `PAYOUT_RELEASED`, `PAYOUT_FAILED`, `ADJUSTMENT`
- `payout_status`: `PENDING`, `HELD`, `RELEASED`, `FAILED`
- `transfer_method`: `EMAIL`, `FRIEND_CODE`
- `transfer_status`: `PENDING`, `ACCEPTED`, `REVOKED`, `EXPIRED`
- `stream_status`: `IDLE`, `TESTING`, `ACTIVE`, `DISCONNECTED`, `ENDED` — `TESTING` is the creator's pre-publish setup test, distinct from the show-day `event_status` value `SOUNDCHECK` (see §6).
- `refund_status`: `REQUESTED`, `EVIDENCE_BUILDING`, `AUTO_RECOMMENDED`, `NEEDS_HUMAN_REVIEW`, `APPROVED`, `DENIED`, `PROCESSED`, `CANCELLED` — this is the refund **request lifecycle**.
- `refund_recommendation`: `APPROVE`, `DENY`, `NEEDS_HUMAN` — this is the **output of the rule engine** (§9.2), stored on the request; it is advisory and distinct from `refund_status`.
- `dispute_status`: `NEEDS_RESPONSE`, `EVIDENCE_BUILDING`, `EVIDENCE_READY`, `SUBMITTED`, `WON`, `LOST`, `ACCEPTED`, `EXPIRED`, `ESCALATED` — `ESCALATED` is enum-reserved for a dispute a reviewer routes to manual handling; the core MVP flow (§9.3) runs evidence-submission → won/lost.

### 5.2 Tables by module (key columns)

**identity**
- `attend_profiles` — `id` (= `auth.users.id`), `display_name`, `email`, `role` (`attend_role`), `avatar_url`
- `attend_artist_profiles` — `id`, `profile_id`→profiles (unique), `stage_name`, `bio`, `avatar_url`, `links` (jsonb)
- `attend_payout_accounts` — `id`, `profile_id`→profiles, `stripe_connect_account_id`, `status` (`ONBOARDING`/`VERIFIED`/`RESTRICTED`/`DISABLED`), `charges_enabled` (bool), `payouts_enabled` (bool)

**events**
- `attend_events` — `id`, `slug` (unique), `creator_id`→profiles, `title`, `description`, `show_type`, `status` (`event_status`), `starts_at`, `ends_at`, `timezone`, `visibility` (`PUBLIC`/`PRIVATE`), `hero_media_id`→event_media (nullable), `refund_cutoff_hours` (int), `transfer_cutoff_hours` (int), `policy_text`, `replay_available` (bool, default false)
- `attend_event_media` — `id`, `event_id`→events, `kind` (`HERO_IMAGE`/`HERO_VIDEO`/`POSTER`/`GALLERY`), `storage_path` (Supabase Storage), `position`

**ticketing**
- `attend_ticket_types` — `id`, `event_id`→events, `name`, `kind` (`ticket_type_kind`), `price_cents` (int), `currency`, `quantity_total` (int), `quantity_sold` (int, maintained counter — counts held + sold tickets, reconcilable against live ticket rows), `max_per_order` (int), `sales_start_at`, `sales_end_at`, `status` (`ACTIVE`/`PAUSED`/`SOLD_OUT`/`HIDDEN`)
- `attend_orders` — `id`, `buyer_id`→profiles, `event_id`→events, `status` (`order_status`), `subtotal_cents`, `hyve_fee_cents`, `processor_fee_cents`, `tax_cents`, `total_cents`, `currency`, `fee_mode` (`ABSORB`/`PASS_TO_BUYER`), `policy_snapshot` (jsonb — event policy frozen at purchase), `stripe_checkout_session_id`, `stripe_payment_intent_id`
- `attend_order_line_items` — `id`, `order_id`→orders, `ticket_type_id`→ticket_types, `quantity`, `unit_price_cents`
- `attend_tickets` — `id`, `order_id`→orders, `event_id`→events, `ticket_type_id`→ticket_types, `owner_id`→profiles (nullable until assigned), `access_token` (unique), `state` (`ticket_state`), `checked_in_at`
- `attend_ticket_transfers` — `id`, `ticket_id`→tickets, `from_profile_id`→profiles, `to_email` (nullable), `to_profile_id`→profiles (nullable, set on accept), `method` (`transfer_method`), `claim_token` (unique, nullable), `friend_code` (unique, nullable, format `HYVE-XXXX-XXXX`), `status` (`transfer_status`), `accepted_at`, `revoked_at`, `expires_at`

**payments**
- `attend_payments` — `id`, `kind` (`payment_kind`), `order_id`→orders (nullable), `event_id`→events (nullable), `profile_id`→profiles, `amount_cents`, `currency`, `status` (`payment_status`), `stripe_payment_intent_id`, `stripe_charge_id`, `stripe_refund_id` (nullable). Payout `Transfer` calls reference this row's `stripe_charge_id`.
- `attend_ledger_entries` (append-only) — `id`, `event_id`→events (nullable), `order_id`→orders (nullable), `payment_id`→payments (nullable), `ticket_id`→tickets (nullable), `type` (`ledger_entry_type`), `amount_cents` (signed bigint), `currency`, `description`, `source` (`SYSTEM`/`HUMAN`), `created_by`, `created_at`
- `attend_payouts` — `id`, `event_id`→events, `payout_account_id`→payout_accounts, `amount_cents`, `currency`, `status` (`payout_status`), `hold_reason` (nullable), `scheduled_release_at`, `released_at`, `stripe_transfer_id` (nullable)

**streaming**
- `attend_streams` — `id`, `event_id`→events (unique), `provider` (`'mux'`), `mux_stream_id`, `mux_playback_id`, `stream_key` (secret), `rtmp_url`, `status` (`stream_status`), `test_passed_at` (timestamptz, nullable — set when a `TESTING` run succeeds), `recording_asset_id` (nullable), `started_at`, `ended_at`
- `attend_stream_health_metrics` — `id`, `stream_id`→streams, `recorded_at`, `ingest_bitrate` (nullable), `dropped_frames` (nullable), `playback_error_count` (nullable), `source` (`PROVIDER_WEBHOOK`/`ATTENDEE_REPORT`), `metadata` (jsonb)

**eventroom**
- `attend_attendance_sessions` — `id`, `ticket_id`→tickets, `profile_id`→profiles, `event_id`→events, `joined_at`, `left_at` (nullable), `watch_seconds` (int), `device`, `browser`, `ip_hash`, `playback_error_count` (int)
- `attend_chat_messages` — `id`, `event_id`→events, `profile_id`→profiles, `body`, `moderation_state` (`VISIBLE`/`HIDDEN`/`DELETED`)
- `attend_reaction_events` — `id`, `event_id`→events, `profile_id`→profiles, `kind` (emoji/applause identifier)
- `attend_moderation_actions` — `id`, `event_id`→events, `moderator_id`→profiles, `target_type` (`MESSAGE`/`USER`), `target_id`, `action` (`HIDE`/`MUTE`/`BAN`/`UNMUTE`), `reason`

**refunds**
- `attend_refund_requests` — `id`, `ticket_id`→tickets, `order_id`→orders, `event_id`→events, `requester_id`→profiles, `reason`, `status` (`refund_status`), `recommendation` (`refund_recommendation`, nullable), `evidence_packet_id`→evidence_packets (nullable), `resolved_by`→profiles (nullable), `resolved_at` (nullable)
- `attend_evidence_packets` — `id`, `subject_type` (`REFUND`/`DISPUTE`), `refund_request_id`→refund_requests (nullable), `dispute_id`→disputes (nullable), `payload` (jsonb — the assembled evidence summary), `score` (numeric, nullable), `generated_at`
- `attend_disputes` — `id`, `payment_id`→payments, `order_id`→orders, `event_id`→events, `stripe_dispute_id` (unique), `reason`, `amount_cents`, `status` (`dispute_status`), `evidence_packet_id`→evidence_packets (nullable), `due_by`

**promotion**
- `attend_promotion_campaigns` — `id`, `event_id`→events (unique), `budget_cents` (int, default `5000`), `status` (`ACTIVE`/`PAUSED`/`EXHAUSTED`/`CLOSED`)
- `attend_promotion_spend` — `id`, `campaign_id`→promotion_campaigns, `kind` (`INTERNAL_PLACEMENT`/`EXTERNAL`), `amount_cents`, `impressions` (int), `clicks` (int), `conversions` (int), `recorded_at`

**risk**
- `attend_risk_scores` — `id`, `subject_type` (`EVENT`/`USER`), `subject_id` (uuid), `score` (numeric), `factors` (jsonb), `computed_at`

**cross-cutting**
- `attend_webhook_events` — `id`, `provider` (`STRIPE`/`MUX`), `provider_event_id` (unique), `event_type`, `payload` (jsonb), `processed_at` (nullable)
- `attend_audit_logs` — `id`, `actor_id` (nullable), `actor_type` (`HUMAN`/`SYSTEM`), `action`, `entity_type`, `entity_id`, `metadata` (jsonb), `ip_hash` (nullable), `user_agent` (nullable)
- `attend_notifications` — `id`, `profile_id`→profiles, `kind`, `payload` (jsonb), `channels` (text[] — `IN_APP`/`EMAIL`), `read_at` (nullable)

### 5.3 Atomic RPC functions
Money-critical and multi-table writes are Postgres functions, each called via a single PostgREST `rpc` call so its body runs in one implicit transaction. All computation (fees, eligibility, validation) happens in TypeScript first; the function only performs the validated atomic persist.

- `attend_create_pending_order(...)` — when the buyer confirms a cart: insert `order` (`PENDING`), `order_line_items`, and the N `tickets` (`HELD_IN_CART`); increment `ticket_types.quantity_sold` to hold inventory.
- `attend_complete_checkout(...)` — on confirmed payment: move the order `PENDING → PAID`, move its tickets `HELD_IN_CART → ASSIGNED_TO_BUYER` (owner = buyer), and post the ledger entries (`TICKET_GROSS`, `HYVE_PLATFORM_FEE`, `PROCESSOR_FEE_ESTIMATE`, `TAX_COLLECTED`, `ARTIST_NET_PENDING`).
- `attend_pay_registration(...)` — move event `REGISTRATION_PENDING → PROMOTION_FEE_PAID`, create the `promotion_campaign`, post `PROMOTION_REGISTRATION_FEE` + `PROMOTION_BUDGET_ALLOCATED`.
- `attend_claim_transfer(...)` — set transfer `ACCEPTED`, reassign `ticket.owner_id`, set ticket state `TRANSFER_ACCEPTED`.
- `attend_process_refund(...)` — move refund request to `PROCESSED`, set ticket `REFUNDED`, post `REFUND_DEBIT`, update order status.
- `attend_release_payout(...)` — set payout `RELEASED`, post `PAYOUT_RELEASED`.
- `attend_cancel_event_refunds(...)` — for a `REFUNDING` event, post `REFUND_DEBIT` entries and set ticket states `CANCELLED` for the batch of cancellation refunds (called idempotently by the settlement path).

## 6. Creator flow

The creator side is governed by the **event lifecycle state machine**, owned by the `events` module. Event `status` changes only through guarded transition methods; §6.9 is the authoritative transition table. Each guard encodes a build-bible rule.

The creator's path to a live show:
1. **Creator account** — an `attend_profiles` row with role `CREATOR` plus an `attend_artist_profiles` row.
2. **Create event** (`DRAFT`) — title, `show_type`, date/time/timezone, hero media (Supabase Storage), refund/transfer cutoffs and policy text.
3. **Ticket types** — kind, `price_cents`, `quantity_total`, `max_per_order`, sales window.
4. **Setup gates** — a paid show then walks a fixed chain of setup states, each representing the next required step:
   - `REGISTRATION_PENDING` — pay the $50 registration fee (a one-time Stripe charge); `attend_pay_registration` posts the ledger entries and creates the promotion campaign.
   - `PAYOUT_SETUP_REQUIRED` — complete Stripe Connect Express onboarding until the account is `VERIFIED`.
   - `STREAM_SETUP_REQUIRED` — the `streaming` module creates the Mux Live stream (`attend_streams` row, RTMP URL + key); a successful stream `TESTING` run records `attend_streams.test_passed_at`, or an admin grants an override.
   A `FREE_EVENT` skips `REGISTRATION_PENDING`, `PROMOTION_FEE_PAID`, and `PAYOUT_SETUP_REQUIRED`, going from `DRAFT` straight to `STREAM_SETUP_REQUIRED`.
5. **Submit & review** — `SUBMITTED_FOR_REVIEW`; the `risk` module scores the event; low-risk auto-approves, flagged events wait for an Attend admin; rejection returns the event to `DRAFT`.
6. **On sale** — `PUBLISHED → ON_SALE`; tickets are buyable. An admin or the risk engine can pause/resume sales via `SALES_PAUSED`.
7. **Show day** — `SOUNDCHECK` (the show-day pre-broadcast check) → `DOORS_OPEN` → `LIVE` (driven by the Mux stream going active) → `ENDED`.
8. **Settlement** — `ENDED → SETTLEMENT_HOLD → SETTLED` (see §9.4).

Two distinct "soundchecks" exist and are intentionally separate: the stream `TESTING` run is the creator's pre-publish setup test (satisfies `STREAM_SETUP_REQUIRED`); the event `SOUNDCHECK` status is the show-day pre-broadcast check that happens after the event is on sale.

**Creator dashboard** (`/attend/(creator)/`) surfaces: create show, pay registration, ticket tiers, stream setup/test, live sales, promotion results, attendee list, refund/dispute status, payout estimate.

### 6.9 Event lifecycle transition table

This is the authoritative set of legal transitions. Any transition not listed is illegal and rejected by the `events` service.

| From | To | Trigger | Guard |
|------|-----|---------|-------|
| — | `DRAFT` | creator creates an event | — |
| `DRAFT` | `REGISTRATION_PENDING` | creator finishes basics + ticket types (paid show) | ≥1 ticket type; required fields set |
| `DRAFT` | `STREAM_SETUP_REQUIRED` | same, for a `FREE_EVENT` | free show — skips fee + payout |
| `REGISTRATION_PENDING` | `PROMOTION_FEE_PAID` | `attend_pay_registration` | $50 payment succeeded |
| `PROMOTION_FEE_PAID` | `PAYOUT_SETUP_REQUIRED` | automatic | — |
| `PAYOUT_SETUP_REQUIRED` | `STREAM_SETUP_REQUIRED` | Connect account becomes `VERIFIED` | `payout_accounts.payouts_enabled` |
| `STREAM_SETUP_REQUIRED` | `SUBMITTED_FOR_REVIEW` | creator submits | `attend_streams.test_passed_at` set, or admin override |
| `SUBMITTED_FOR_REVIEW` | `PUBLISHED` | admin approves, or auto-approve | risk score below threshold, or admin approve |
| `SUBMITTED_FOR_REVIEW` | `DRAFT` | admin rejects | — |
| `PUBLISHED` | `ON_SALE` | sales window opens | now ≥ earliest `sales_start_at` |
| `ON_SALE` | `SALES_PAUSED` | admin or risk engine pauses sales | — |
| `SALES_PAUSED` | `ON_SALE` | admin resumes sales | — |
| `ON_SALE`, `SALES_PAUSED` | `SOUNDCHECK` | creator starts the show-day check, or a scheduled job near `starts_at` | — |
| `SOUNDCHECK` | `DOORS_OPEN` | creator opens doors | — |
| `DOORS_OPEN` | `LIVE` | Mux stream goes active (webhook) | stream `ACTIVE` |
| `LIVE` | `ENDED` | Mux stream ends (webhook), or creator ends the show | — |
| `LIVE` | `ENDED` | `attendance-finalize` job, fallback | event past `ends_at` + grace window, no end signal received |
| `ENDED` | `SETTLEMENT_HOLD` | `settlement` job, automatically | — |
| `SETTLEMENT_HOLD` | `SETTLED` | `settlement` job | hold window elapsed, risk checks pass, all payouts `RELEASED`/`FAILED` |
| `SETTLED` | `ARCHIVED` | retention job or admin | retention period elapsed |
| `DRAFT`, `REGISTRATION_PENDING`, `PROMOTION_FEE_PAID`, `PAYOUT_SETUP_REQUIRED`, `STREAM_SETUP_REQUIRED`, `SUBMITTED_FOR_REVIEW`, `PUBLISHED`, `ON_SALE`, `SALES_PAUSED`, `SOUNDCHECK`, `DOORS_OPEN` | `CANCELLED` | creator (pre-sale) or admin | — |
| `LIVE` | `CANCELLED` | admin (abandoned show) | — |
| `CANCELLED` | `REFUNDING` | automatic | event has sold tickets |
| `CANCELLED` | `ARCHIVED` | automatic | event has no sold tickets |
| `REFUNDING` | `SETTLED` | `settlement` job | all cancellation refunds processed |

`replay_available` is a separate boolean on `attend_events`, set by the `replay-processing` job when the Mux recording asset is ready; it is not a `status` value. An `ENDED` event with no sold tickets still passes through `SETTLEMENT_HOLD → SETTLED` (with no payouts) before `ARCHIVED`.

**Transition authority:** the creator drives create/submit and the show-day transitions; an Attend admin drives approve/reject, sales pause/resume, cancellation, and overrides; the system (Mux webhooks, jobs) drives setup-gate advancement, live/ended, and settlement. Every transition validates its guard and refuses illegal sequences.

## 7. Buyer flow

1. **Discovery** — `/attend` lists and searches events (live, upcoming, by type); a featured row is driven by active `attend_promotion_campaigns`.
2. **Event page** — `/attend/events/[slug]`: hero, artist, viewer-localized date/time, ticket tiers, the **all-in price shown upfront** (FTC rule, §5/§23), policy summary, add-to-calendar.
3. **Checkout** — select ticket types and quantities (one order, many tickets). The **fee calculator** computes the breakdown (§9.1) and shows it itemized before payment. Confirming calls `attend_create_pending_order`, which creates a `PENDING` order and `HELD_IN_CART` tickets to hold inventory; a Stripe Checkout session is then opened for that order.
4. **Payment** — Stripe Checkout, one-time variable price (modeled on the repo's existing Sentinel one-time pattern). HYVE uses **separate charges + transfers**: the buyer pays the platform; the artist is paid later by a Stripe `Transfer` (referencing `attend_payments.stripe_charge_id`) after the payout hold clears. This is required so HYVE can hold funds through the event + risk window (§16).
5. **Fulfilment** — the `checkout.session.completed` webhook calls `attend_complete_checkout` atomically, moving the order to `PAID` and its tickets to `ASSIGNED_TO_BUYER`. Idempotency is enforced via `attend_webhook_events`.
6. **Wallet** — `/attend/(attendee)/wallet`: upcoming tickets, each ticket's state, transfer status, friend code, enter-show button, refund status.
7. **Transfers** — a buyer can transfer any ticket they own; both methods create an `attend_ticket_transfers` row with an `expires_at`.
   - *Email transfer* — the buyer enters a recipient address; the row is created with `method = EMAIL` and a unique `claim_token`; the ticket moves to `TRANSFER_PENDING_EMAIL`; Resend sends a claim link. The recipient opens the link, signs in or signs up via Supabase Auth, and accepts; `attend_claim_transfer` reassigns ownership and sets the ticket `TRANSFER_ACCEPTED`.
   - *Friend-code transfer* — at transfer initiation the system generates a unique one-time `friend_code` (`HYVE-XXXX-XXXX`) on the row with `method = FRIEND_CODE`; the ticket moves to `TRANSFER_PENDING_FRIEND_CODE`. No recipient is named — the buyer shares the code out-of-band. A recipient redeems it at `/attend/claim`, signs in or signs up, and accepts via `attend_claim_transfer`. The code is single-use and invalid after acceptance or expiry.
   - *Revoke* — while a transfer is `PENDING` (email link unopened, or friend code unredeemed) the buyer can revoke it: the transfer `status` becomes `REVOKED` and the ticket returns to its owned-idle state.
   - *Locks* — transfers cannot be initiated once a ticket is checked in, has a refund request, has a dispute, or is past the event's `transfer_cutoff_hours`.
8. **Cart** — a `PENDING` order's tickets are `HELD_IN_CART`; if the Stripe session expires unpaid, the `cart-expiry` job cancels the order, sets the tickets `EXPIRED`, and decrements `quantity_sold` to restore availability.

### 7.9 Ticket lifecycle transition table

Authoritative legal transitions for `ticket_state`, owned by the `ticketing` service. Any transition not listed is illegal and rejected. (`PURCHASED` and `TRANSFER_REVOKED` are enum-reserved and unused by MVP flows — see §5.1.)

A ticket's **owned-idle state** is `ASSIGNED_TO_BUYER` if its current `owner_id` is the buyer on its order, otherwise `TRANSFER_ACCEPTED`. Its **resting state** is `USED` or `NO_SHOW` once the event has ended (per whether it was checked in), otherwise the owned-idle state.

| From | To | Trigger | Guard |
|------|-----|---------|-------|
| — | `HELD_IN_CART` | `attend_create_pending_order` | inventory available |
| `HELD_IN_CART` | `ASSIGNED_TO_BUYER` | `attend_complete_checkout` (payment confirmed) | order moved to `PAID`; `owner_id` = buyer |
| `HELD_IN_CART` | `EXPIRED` | `cart-expiry` job | order still `PENDING` past the Stripe session expiry |
| `ASSIGNED_TO_BUYER`, `TRANSFER_ACCEPTED` | `TRANSFER_PENDING_EMAIL` | owner starts an email transfer | not checked in; no refund/dispute; before `transfer_cutoff` |
| `ASSIGNED_TO_BUYER`, `TRANSFER_ACCEPTED` | `TRANSFER_PENDING_FRIEND_CODE` | owner starts a friend-code transfer | same guards |
| `TRANSFER_PENDING_EMAIL`, `TRANSFER_PENDING_FRIEND_CODE` | `TRANSFER_ACCEPTED` | recipient accepts (`attend_claim_transfer`) | transfer not expired/revoked |
| `TRANSFER_PENDING_EMAIL`, `TRANSFER_PENDING_FRIEND_CODE` | owned-idle state | owner revokes, or `claim-expiry` expires the transfer | — |
| `ASSIGNED_TO_BUYER`, `TRANSFER_ACCEPTED` | `CHECKED_IN` | attendee enters the event room (first entry) | event in `SOUNDCHECK`/`DOORS_OPEN`/`LIVE` |
| `CHECKED_IN` | `IN_ROOM` | an attendance session opens | — |
| `IN_ROOM` | `CHECKED_IN` | attendee leaves the room (session closes) | — |
| `CHECKED_IN`, `IN_ROOM` | `USED` | `attendance-finalize` job | event `ENDED`; ticket was checked in |
| `ASSIGNED_TO_BUYER`, `TRANSFER_ACCEPTED` | `NO_SHOW` | `attendance-finalize` job | event `ENDED`; ticket never checked in |
| `ASSIGNED_TO_BUYER`, `TRANSFER_ACCEPTED`, `USED`, `NO_SHOW` | `REFUND_REQUESTED` | buyer files a refund request | no active dispute on the order |
| `REFUND_REQUESTED` | `REFUNDED` | refund approved + processed (`attend_process_refund`) | — |
| `REFUND_REQUESTED` | resting state | refund denied | — |
| `ASSIGNED_TO_BUYER`, `TRANSFER_ACCEPTED`, `CHECKED_IN`, `IN_ROOM`, `USED`, `NO_SHOW`, `REFUND_REQUESTED` | `DISPUTED` | Stripe `charge.dispute.created` | — |
| `DISPUTED` | `REFUNDED` | dispute lost or accepted | — |
| `DISPUTED` | resting state | dispute won | — |
| any non-terminal state | `CANCELLED` | event cancelled (`attend_cancel_event_refunds`) | — |

Terminal states: `REFUNDED`, `EXPIRED`, `CANCELLED`. `USED` and `NO_SHOW` are final unless a refund request or dispute supervenes.

## 8. Live experience

1. **Entering the room** — `/attend/events/[slug]/room`. A server component (via the segment's `layout.tsx`, not shared middleware) gates entry: authenticated, owns a valid ticket (`ASSIGNED_TO_BUYER` or `TRANSFER_ACCEPTED`), event in a live-ish state (`SOUNDCHECK`/`DOORS_OPEN`/`LIVE`). On entry the ticket moves to `CHECKED_IN` (its first room entry) and then `IN_ROOM`, and an `attend_attendance_sessions` row opens.
2. **Single active session per ticket** — on entry, any open attendance session for the same ticket is closed and the prior client is signaled (over Supabase Realtime) to disconnect, so a ticket streams on one device at a time (build bible §12).
3. **Video** — Mux Live HLS. The `streaming` module mints a **signed Mux playback token** scoped to the ticket-holder; `hls.js` (already in the repo) plays it. The player handles live/countdown state and a low-bandwidth / audio-only fallback (§13).
4. **Chat & reactions** — Supabase Realtime over `attend_chat_messages` and `attend_reaction_events`; reactions drive a visible energy/applause meter.
5. **Moderation** — `MODERATOR`-role users can hide messages and mute/ban users via `attend_moderation_actions`.
6. **Attendance & stream health** — `attend_attendance_sessions` log join/leave/watch-duration with device + IP-hash; the `attendance-finalize` job closes sessions after the event. The `streaming` module ingests Mux webhooks into `attend_stream_health_metrics`; attendees can also report playback errors. Both feed refund/dispute evidence.
7. **Replay** — Mux recording is enabled; when the asset is ready the `replay-processing` job sets `attend_events.replay_available`, and ticket-holders can play the recording. Advanced VOD features are deferred.

## 9. Back office & automation

### 9.1 Fee calculator (`src/lib/attend/payments/fee-calculator.ts`)
A pure function — no database, no Stripe. The single source of pricing truth.
- **Inputs:** `showType`, `ticketSubtotalCents`, `quantity`, `feeMode` (`ABSORB`/`PASS_TO_BUYER`), `processorFeeEstimateCents`, `taxEstimateCents`, `discountsCents`, `currency`. (These mirror build bible §30's inputs; the `Cents` suffix is a deliberate rename for consistency with the money convention.)
- **Outputs:** `ticketSubtotalCents`, `hyvePlatformFeeCents`, `processorFeeCents`, `taxCents`, `buyerTotalCents`, `artistGrossCents`, `artistNetEstimateCents`, `promotionRegistrationFeeCents`.
- **Rules:** HYVE platform fee = 2.5% for human shows, 5.5% for AI shows (the MVP charges 2.5%); registration fee = 5000 cents per paid show; integer cents only; deterministic round-half-up; never floats.

### 9.2 Refunds (§17)
A buyer request creates an `attend_refund_requests` row. The `refunds` module auto-assembles an `attend_evidence_packets` record from order, ticket, attendance sessions, stream health, transfer history, policy snapshot, and event status. It then runs the **auto-recommendation rules** — pure TypeScript, unit-tested per §31 — which set the request's `recommendation`:
- *Recommend `DENY`:* attendee watched the show, ticket checked in/used, missed the event with no platform outage, ticket successfully transferred and accepted.
- *Recommend `APPROVE`:* event cancelled, artist no-show, global platform outage, stream failed globally for a material portion, duplicate charge, HYVE system error.
- *`NEEDS_HUMAN`:* partial or regional (non-global) stream outage of any kind — including a user who missed the event during such an outage; device/browser/accessibility claims; late start / early end; moderator removal; suspicious fraud; an existing chargeback. Any case not matched by a `DENY` or `APPROVE` rule defaults to `NEEDS_HUMAN`.

Default is **not** auto-approve. The buyer sees a calm, evidence-based "review in progress, up to 30 days" message (§17/§32). A reviewer in `/attend/admin` acts on the evidence summary + recommendation. Approval runs `attend_process_refund` and a Stripe refund.

### 9.3 Disputes (§18)
A Stripe `charge.dispute.created` event (Attend's own webhook) freezes the order and related payout, auto-builds a dispute evidence packet, and surfaces it in `/attend/admin` with the network deadline. `dispute_status` tracks it through evidence submission to won/lost. Active disputes block normal refunds on the same payment.

### 9.4 Payouts & settlement (§16)
`ENDED → SETTLEMENT_HOLD` happens automatically. During `SETTLEMENT_HOLD`, the `payout-release` job releases each event's payout once its hold has cleared: it checks the event ended plus the configured hold period, that risk checks pass, and that no blocking dispute exists; it then computes artist net **from the ledger** (`ARTIST_NET_PENDING` minus refunds/holds), issues a Stripe `Transfer` to the connected account via `attend_release_payout`, and posts `PAYOUT_RELEASED`. A configurable reserve is held against refunds/disputes; high-refund / disputed / cancelled / failed-stream events get extended holds. The hold period, grace window, and reserve percentage are environment-backed configuration constants in the `payments` module; per-event overrides are out of MVP scope.

The separate `settlement` job owns the `SETTLEMENT_HOLD → SETTLED` transition: it moves an event to `SETTLED` only once the hold window has elapsed, risk checks pass, and every payout for the event is `RELEASED` or `FAILED`. For a cancelled event in `REFUNDING`, the same job moves it to `SETTLED` once all cancellation refunds are processed.

### 9.5 Background jobs
The complete job set, cadence, and handler locations are defined in §4.6. Each job is an idempotent handler under `src/app/api/attend/jobs/<name>`, invoked by a GitHub Actions schedule.

### 9.6 Risk (§26)
A rule-based score over events (new organizer, high ticket price, no stream test, missing payout verification, prior disputes) and users (chargeback history, many refund requests, failed payments, device/IP anomalies). Outputs gate admin approval, payout timing, and refund escalation.

## 10. Cross-cutting concerns

- **Auth & roles** — Supabase Auth for end-user accounts (attendees, creators); `attend_profiles.role` carries `USER`/`CREATOR`/`MODERATOR`/`ADMIN`/`REVIEWER`. Authorization is enforced in Attend's own `layout.tsx` files and service layer — the shared `src/middleware.ts` is deliberately not touched. The Attend back office (`/attend/admin`) is gated by the `ADMIN`/`REVIEWER` roles and is independent of the existing umbrella `/admin`.
- **Error handling** — services return typed result values; entry points map them to responses. Webhook handlers record the event idempotently and return 2xx immediately, then process — so provider retries cannot double-post. Money operations fail closed: on any uncertainty, no ledger entry is written and the operation is retried or escalated.
- **Idempotency** — every Stripe/Mux webhook is deduplicated via `attend_webhook_events.provider_event_id`; every job is safe to run twice.
- **Audit** — sensitive actions (refund decisions, payout releases, moderation, admin overrides) write `attend_audit_logs` with actor, IP hash, and `source`.
- **Testing** — unit tests for the fee calculator (§30), transfer eligibility, refund-recommendation rules (§31), and the state-machine transition guards (§6.9 events, §7.9 tickets); integration tests for the checkout RPCs, webhook handlers, and transfer claim — all run against the fake `PaymentProvider`/`StreamProvider`, so the suite is offline and deterministic.
- **Seed data** — seed `HUMAN_LIVE_BROADCAST`, `FREE_EVENT`, and `PRIVATE_EVENT` events across lifecycle states for local development.
- **Compliance** — all checkout prices are all-in with an itemized breakdown (FTC, §5/§23). This is not legal advice; counsel should review before a real-money launch.

## 11. Build order

Dependency-ordered. Each phase is a coherent, independently verifiable increment and becomes one increment of the implementation plan.

1. **Foundation** — `/attend` route skeleton and shell layout; `008_attend_*` migrations (all enums + tables + RPC function stubs); Attend Supabase-Auth wiring and `attend_profiles`; the homepage hub card; module scaffolding; the `money` helper and the fee calculator **with unit tests**.
2. **Creator flow** — event CRUD, the lifecycle state machine and its transition table (§6.9) with guard unit tests, ticket types, the $50 registration charge (`attend_pay_registration`), Stripe Connect onboarding, the creator dashboard.
3. **Buyer flow** — discovery, event page, checkout (`attend_create_pending_order` + `attend_complete_checkout`), the ticket lifecycle (§7.9), the ledger, the wallet.
4. **Transfers** — email transfer, friend-code transfer, claim (`attend_claim_transfer`), revoke.
5. **Streaming + event room** — Mux integration behind `StreamProvider`, signed playback, the event room, chat/reactions over Realtime, attendance sessions, stream-health ingestion.
6. **Back office** — refund requests + evidence builder + recommendation rules, dispute webhook ingestion, the `/attend/admin` review queues, payouts (`attend_release_payout`), event settlement, the background jobs (§4.6), risk scoring.
7. **Hardening** — replay, the full end-to-end test pass, seed data, the MVP acceptance-criteria check (§27).

## 12. MVP acceptance criteria (§27)

The MVP is complete when: a creator can create a human live broadcast event; pay the $50 registration fee; set ticket types and prices; publish the event; a buyer can purchase multiple tickets; transfer a ticket by email and by friend code; a recipient can claim a ticket; an attendee can enter the browser/mobile event room; the artist can broadcast a stream; the room logs attendance; a user can request a refund; the refund auto-builds an evidence summary; an admin can approve/deny it; the ledger records the platform fee and pending payout; the promotion ledger records the $50; and all checkout prices are shown all-in with an itemized breakdown.

## 13. Risks & open questions

- **Tax** — the MVP records a `TAX_COLLECTED` ledger line and an order `tax_cents` field, defaulting to 0 unless a tax rate is configured. Jurisdiction-accurate tax (e.g. Stripe Tax) is a deliberate fast-follow, not MVP.
- **CSP** — Mux HLS playback may require adding Mux domains to the `connect-src`/`media-src` directives in `next.config.mjs`. This is a shared file; if the change is needed it will be flagged for explicit approval before being made — it will not be changed silently.
- **Stripe Connect** — requires Connect to be enabled on the HYVE Stripe account (test mode for the MVP). Connected-account onboarding and verification timing is outside HYVE's control.
- **Job cadence** — Attend's jobs run via GitHub Actions to stay within the Vercel Hobby 3-cron cap. If job volume or latency needs grow, upgrading the Vercel plan should be revisited.
- **Shared `package.json`** — Attend adds new dependencies (the Mux SDK, a QR-code library for tickets, etc.). This grows a shared file additively; it changes no existing feature.
- **Replay scope** — basic Mux recording playback is included; trimming, highlights, and per-show VOD pricing are deferred.
