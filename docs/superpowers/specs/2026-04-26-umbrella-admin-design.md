# HYVE Umbrella Admin — Design Spec

**Project:** Multi-product admin dashboard at `www.hyveapp.co/admin` covering financial reporting, traffic reporting, and admin-user management across the entire VSS / HYVE umbrella (Messenger, Spy, Sentinel).
**Status:** Approved during brainstorming session 2026-04-26
**Owner:** vibesoftwaresolutions@gmail.com (seed owner)
**Repo:** `AnonOrange/hyve-landing` (Next.js 14 on Vercel, raw-REST Supabase pattern)
**Supersedes:** `2026-04-25-admin-dashboard.md` (single-product Messenger admin) — that spec was drafted when hyveapp.co was just the Messenger landing page; the site has since restructured into a multi-product umbrella with Sentinel and a 15-tab Spy app, invalidating much of the original architecture.

---

## Overview

### What

A protected `/admin/*` section of www.hyveapp.co — server-rendered Next.js pages, gated by a custom auth layer, that gives any authenticated admin a single-pane-of-glass view of:

- **Money** — Stripe revenue rolled up across Messenger / Spy / Spy Pro / Sentinel, plus per-product breakdown, MRR, active subs, recent purchases, failed payments
- **Traffic** — visitors / sources / geo / **per-product conversion funnel** (each product has its own funnel)
- **Admin Users** — list of active admins, invite-by-email flow (owner-only), revoke (owner-only), audit log of every admin action
- **Site Command Center** — TLS / DNS / DNSSEC / security headers / brute-force log / deploy history / Stripe disputes / GitHub APK download counts

All data flows through Supabase (already in the stack, used for Sentinel + spy admin recon) plus Vercel KV for ephemeral hot data (sessions, lockout counters).

### Why

1. **Multi-product visibility.** The site has grown from one product to four: Messenger, Spy, Spy Pro, Sentinel. There is no place today where the operator can see "this week's revenue across all products" or "which product converts best." Each product's data is scattered (Stripe, hyve-id, hyve-api, Supabase, GitHub releases).
2. **Multi-admin scaling.** The current admin pattern (`/spy/admin`) hardcodes the allowlist as a 2-element `Set` in source code. Adding a third admin requires a code commit + deploy. As the team grows (already 2 people: vibesoftwaresolutions@ and luckybstudios@), this is unsustainable. The new system stores admins in Supabase with an invite-by-email UI.
3. **Single source of truth for "who is an admin."** Today: 2 hardcoded emails in `/spy/admin/page.tsx`. Tomorrow: rows in `admins` table with role, audit history, invite chain. Single revoke point if someone leaves.
4. **Privacy continuity.** First-party tracker (no PostHog, no Vercel Analytics) keeps the privacy promise that's central to the brand. Daily-rotated `vid_hash` makes cross-day visitor correlation cryptographically impossible.

### Success criteria

- Open `/admin` after sign-in: full at-a-glance dashboard renders in <100ms (reading from Supabase snapshot rows, not external APIs)
- Stripe purchase across any product appears in "Recent purchases" within ~2 seconds of payment (via webhook → Supabase row)
- Owner can invite a new admin: enter email + role → recipient receives Resend email → recipient sets password + PIN → invited admin can sign in within minutes
- Owner cannot accidentally lock themselves out (revoke / role-change refuses if it would leave zero owners)
- Brute-force admin login is auto-blocked after 5 failures from one IP within 15 minutes
- Site Command Center surfaces TLS expiry warning ≥30 days before cert dies

### Out of scope (deliberately, for v1)

- **Migrating `/spy/admin` recon/queue UI into the umbrella.** That stays at `/spy/admin/*`, deep-linked from the umbrella Overview tab. Different concerns (operational vs cross-product reporting).
- **Per-product admin role scoping** (e.g. `messenger_admin`, `spy_admin`). v1 is `owner` + `admin`, both can see everything. Granular roles can be retrofitted later.
- **TOTP / hardware key MFA.** Password + 6-digit PIN is the v1 second factor. TOTP is a later upgrade path.
- **SSO / Google OAuth sign-in.** Custom auth only.
- **Mobile-responsive admin.** Desktop-only (≥1024px viewport).
- **End-user management** (banning users, issuing refunds). Operator does those in Stripe + product-specific admins directly.
- **Real-time WebSocket updates.** 5-min cron freshness is acceptable for this use case; manual "Scan now" button bypasses cache when fresher data is needed.
- **Email alerts on threat-level escalation.** Pull-only, no push.
- **Plans 1-3 from the previous (Messenger-only) admin design.** Retired entirely. Some component code from Plan 2's UI work can be cherry-picked but the architecture is fresh.

---

## Architecture

### High-level

```
                      www.hyveapp.co (Next.js on Vercel)
┌──────────────────────────────────────────────────────────────────┐
│                                                                   │
│  PUBLIC routes                    ADMIN routes (/admin/*)         │
│  ─────────────                    ──────────────────────          │
│  /  /messenger  /spy/...          /admin/login                    │
│                                   /admin/forgot-password          │
│  + tracker JS (1 KB inline)       /admin/reset-password?token=…   │
│      ↓                            /admin/accept-invite?token=…    │
│  POST /api/track                  /admin            (Overview)    │
│  (writes traffic_events           /admin/financial                │
│   to Supabase)                    /admin/traffic                  │
│                                   /admin/users  ← admin user mgmt │
│                                   /admin/security                 │
│                                                                   │
│                                   middleware.ts                   │
│                                   (KV session lookup + role gate) │
│                                       ↓                           │
│                                   /api/admin/*                    │
│                                   (reads Supabase + KV)           │
└──────────────────────────────────────────────────────────────────┘
        │                                  ↑
        ↓                                  │
┌──────────────────────────────────────────────────────────────────┐
│  Supabase (raw REST pattern, no SDK)                              │
│  NEW tables:                                                      │
│   ▸ admins              who has admin access (with role)          │
│   ▸ admin_invites       outstanding email-invite tokens           │
│   ▸ admin_password_resets  forgot-password tokens                 │
│   ▸ admin_audit_log     every admin action (sign-in, invite, …)   │
│   ▸ traffic_events      raw tracker hits (rolling 60d)            │
│   ▸ snapshots           keyed JSON cron snapshots (5-min refresh) │
│   ▸ recent_purchases    Stripe webhook rows (forever)             │
│   ▸ failed_payments     Stripe webhook rows (forever)             │
│  EXISTING (untouched): sentinel_audits, sentinel_findings, …      │
└──────────────────────────────────────────────────────────────────┘
        ↑                                  ↑
        │                                  │
┌───────┴──────────────────────────────────┴──────────────────────┐
│  Vercel KV (ephemeral hot data only)                              │
│   ▸ session:<64-hex>      24h sliding-TTL admin sessions          │
│   ▸ login_fail:<ip>       brute-force counter, 15m TTL            │
│   ▸ forgot_pw_rate:<ip>   forgot-password rate limit              │
│   ▸ scan_lock             30s "scan now" cooldown                 │
└──────────────────────────────────────────────────────────────────┘
        ↑
        │
┌───────┴──────────────────────────────────────────────────────────┐
│  Vercel Cron (vercel.json) — every 5 min                          │
│   /api/cron/snapshot:                                             │
│     ▸ Stripe rolled-up revenue + per-product breakdown            │
│       (Messenger / Spy / Spy Pro / Sentinel)                      │
│     ▸ HYVE user count (hyve-id /v1/stats)                         │
│     ▸ Sentinel audit counts (Supabase query)                      │
│     ▸ All-services health pings (relay / hyve-id / hyve-api /     │
│       Supabase / Stripe)                                          │
│     ▸ TLS expiry / DNS / GitHub APK download count                │
│     ▸ Compose threat level → write snapshots back to Supabase     │
│   /api/cron/cleanup:  hourly retention pruning                    │
└──────────────────────────────────────────────────────────────────┘
        ↑
        │ Stripe pushes (Sentinel webhook UNCHANGED)
┌───────┴──────────────────────────────────────────────────────────┐
│  POST /api/stripe/webhook (NEW — Messenger + Spy + Spy Pro)       │
│   ▸ checkout.session.completed → recent_purchases (Supabase)      │
│   ▸ invoice.payment_failed → failed_payments (Supabase)           │
│   ▸ customer.subscription.deleted → recompute snapshots:subs      │
│  Idempotent via UNIQUE(stripe_session). Different signing secret  │
│  from /api/spy/sentinel/webhook so blast radius is contained.     │
└──────────────────────────────────────────────────────────────────┘
```

### Locked decisions

| Decision | Choice | Why |
|---|---|---|
| Hosting | `/admin` on existing Next.js app (umbrella) | User picked A in clarifying Q1 — matches umbrella site restructure |
| Storage primary | Supabase (raw REST, no SDK) | Matches existing codebase; SQL beats KV for per-product rollups + 60-day raw retention |
| Storage hot | Vercel KV (sessions + counters only) | TTL + atomic counters fit KV well; smaller surface than Plan 1 |
| Auth | Custom bcrypt password+PIN | User picked A in Q2 — matches existing custom-everything style |
| Roles | `owner` + `admin` | User picked B in Q3 — minimal model that prevents lockout footgun |
| Tracker | Custom first-party → Supabase | User picked A in Q4 — privacy-first; per-product attribution unlocked |
| Cron | Vercel Cron, every 5 min | Standard pattern; CRON_SECRET fail-closed (the bug we already shipped a fix for) |
| Real-time path | Stripe webhook → Supabase row | Purchases visible in ~2s |
| Stripe webhook scope | NEW unified webhook for Messenger + Spy + Spy Pro; Sentinel webhook unchanged | Don't touch what's working; isolated blast radius if a secret leaks |
| Existing `/spy/admin` | KEEP — deep-link from umbrella Overview | Plan 1's recon/queue UI works; not in this spec's scope |
| Forgot password | Yes — `admin_password_resets` table | User explicitly asked for it |

---

## Auth + Admin User Management

This is the meaningful delta vs the prior single-admin spec.

### Tables

```sql
-- ── admins: who has access today ─────────────────────────
CREATE TABLE admins (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT         UNIQUE NOT NULL,
  password_hash   TEXT         NOT NULL,           -- bcrypt cost 12
  pin_hash        TEXT         NOT NULL,           -- bcrypt cost 12
  role            TEXT         NOT NULL CHECK (role IN ('owner', 'admin')),
  invited_by      UUID         REFERENCES admins(id),    -- null for the seed owner
  invited_at      TIMESTAMPTZ  DEFAULT now(),
  accepted_at     TIMESTAMPTZ  NOT NULL,
  last_login_at   TIMESTAMPTZ,
  active          BOOLEAN      NOT NULL DEFAULT true     -- soft delete; revoked=false
);
CREATE INDEX admins_email_active ON admins(email) WHERE active = true;

-- ── admin_invites: outstanding invites (7d expiry, one-time) ──
CREATE TABLE admin_invites (
  token           TEXT         PRIMARY KEY,        -- 32-byte hex from crypto.getRandomValues
  email           TEXT         NOT NULL,
  role            TEXT         NOT NULL CHECK (role IN ('owner', 'admin')),
  invited_by      UUID         NOT NULL REFERENCES admins(id),
  invited_at      TIMESTAMPTZ  DEFAULT now(),
  expires_at      TIMESTAMPTZ  NOT NULL,
  used_at         TIMESTAMPTZ
);
CREATE INDEX admin_invites_email_open ON admin_invites(email) WHERE used_at IS NULL;

-- ── admin_password_resets: forgot-password tokens (1h expiry) ──
CREATE TABLE admin_password_resets (
  token           TEXT         PRIMARY KEY,
  admin_id        UUID         NOT NULL REFERENCES admins(id),
  requested_at    TIMESTAMPTZ  DEFAULT now(),
  expires_at      TIMESTAMPTZ  NOT NULL,
  used_at         TIMESTAMPTZ
);
CREATE INDEX admin_password_resets_admin_open ON admin_password_resets(admin_id) WHERE used_at IS NULL;

-- ── admin_audit_log: every admin action, append-only ──────────
CREATE TABLE admin_audit_log (
  id              BIGSERIAL    PRIMARY KEY,
  ts              TIMESTAMPTZ  DEFAULT now(),
  actor_email     TEXT         NOT NULL,
  action          TEXT         NOT NULL,           -- 'sign_in' | 'sign_out' | 'invite' | 'invite_accepted' | 'revoke' | 'role_change' | 'login_fail' | 'reset_requested' | 'password_reset' | 'scan'
  target_email    TEXT,
  detail          TEXT,
  ip              TEXT
);
CREATE INDEX admin_audit_log_ts ON admin_audit_log(ts DESC);
```

### Flows

#### Sign-in (any admin)

`POST /api/admin/login` body: `{ email, password, pin }`
1. Resolve client IP (`x-forwarded-for`, fall back to `'unknown'`)
2. If `login_fail:<ip>` ≥ 5 → `429 Too Many Requests` with `Retry-After: 900`
3. Look up `admins` row by email where `active = true`. If not found → record failure + `401 Invalid credentials` (generic, never leak which field was wrong)
4. `Promise.all([bcrypt.compare(password, row.password_hash), bcrypt.compare(pin, row.pin_hash)])` — always run both, even on email mismatch (constant-ish timing)
5. On success: clear `login_fail:<ip>`, generate 32-byte hex session ID via `crypto.getRandomValues` (Web Crypto, runs on Edge), `kv.set(session:<id>, { admin_id, email, role, ip, createdAt, lastActiveAt }, { ex: 86400 })`, set `__Host-admin_session` cookie (HttpOnly, Secure, SameSite=Strict, Path=/), `UPDATE admins SET last_login_at = now()`, write audit log
6. Return `{ ok: true }`

#### Logout

`POST /api/admin/logout` → `kv.del(session:<id>)`, write audit log, clear cookie.

#### Forgot password

`POST /api/admin/forgot-password` body: `{ email }`
1. Rate-limit per IP via `forgot_pw_rate:<ip>` counter (max 3 / 15 min)
2. **Always return `200 { ok: true }` regardless of whether email matches** — generic message: *"If that email is on the admin allowlist, a reset link is on its way."* Don't leak the admin allowlist.
3. If email matches an active admin: insert `admin_password_resets` row (token, 1h expiry), Resend email with link `https://www.hyveapp.co/admin/reset-password?token=<token>`, write audit log

`GET /admin/reset-password?token=…` → form to set new password + new PIN
`POST /api/admin/reset-password` body: `{ token, password, pin }`
1. Look up by token where `used_at IS NULL AND expires_at > now()`
2. Bcrypt-hash both, `UPDATE admins SET password_hash = ?, pin_hash = ? WHERE id = ?`
3. `UPDATE admin_password_resets SET used_at = now()`
4. **Delete all KV sessions for this admin** (force re-login; kicks out any ongoing attacker)
5. Audit log, redirect to `/admin/login`

#### Invite (owner only)

`POST /api/admin/invite` body: `{ email, role: 'owner'|'admin' }`
1. Resolve session → 403 if `role !== 'owner'`
2. Generate 32-byte hex token
3. `INSERT INTO admin_invites (token, email, role, invited_by, expires_at)` — expires_at = now + 7 days
4. Resend mail: *"You've been invited to admin hyveapp.co — click to set your password: https://www.hyveapp.co/admin/accept-invite?token=…"*
5. Audit log, return `{ ok: true, expires_at }`

`GET /admin/accept-invite?token=…` → looks up token, renders form (set password + PIN)
`POST /api/admin/accept-invite` body: `{ token, password, pin }` → bcrypt-hashes, INSERTs `admins` row, marks invite `used_at = now()`, audit log, redirect to `/admin/login`.

#### Revoke (owner only)

`POST /api/admin/revoke` body: `{ admin_id }`
1. Owner-only; 403 otherwise
2. **Guardrail: cannot revoke yourself**
3. **Guardrail: cannot revoke the last active owner** — `SELECT count(*) FROM admins WHERE role='owner' AND active=true`; if the target is the only owner and there are no other active owners, return 400 with descriptive error
4. `UPDATE admins SET active = false WHERE id = ?`
5. Delete all KV sessions for that email (full sign-out of any open browser tabs)
6. Audit log

#### Role change (owner only)

`POST /api/admin/set-role` body: `{ admin_id, role }`
- Same owner-only + last-owner guardrails
- `UPDATE admins SET role = ? WHERE id = ?`
- Audit log

### Initial seeding

When `/api/admin/login` runs for the first time and the `admins` table is empty:
- Read env vars `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD_HASH`, `ADMIN_SEED_PIN_HASH`
- INSERT one row: `role = 'owner'`, `accepted_at = now()`, `invited_by = null`
- Guarantees self-recovery: a fresh deploy can always sign in via the seed env vars

After first sign-in, the seed owner uses `/admin/users` to invite anyone else.

### Anti-brute-force

- `login_fail:<ip>` counter in KV with 15-min TTL
- 5 failures → `429`, `Retry-After: 900`
- Successful login resets counter

### Sessions

- 64-char hex random ID in `__Host-admin_session` cookie (HttpOnly, Secure, SameSite=Strict)
- Stored in KV with 24h sliding TTL
- Revocable instantly by `kv.del`
- `__Host-` prefix forces browser to require `Secure`, `Path=/`, no `Domain` attribute → prevents subdomain-based session-fixation attacks

### CSRF

- `SameSite=Strict` + `Origin` header check on all POST routes
- No CSRF tokens needed for this scale

### Env vars added

| Var | Purpose |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | Already set (Sentinel uses them) |
| `RESEND_API_KEY` | Already set |
| `ADMIN_SEED_EMAIL` | Email for the auto-seeded first owner |
| `ADMIN_SEED_PASSWORD_HASH` | bcrypt of seed owner's password |
| `ADMIN_SEED_PIN_HASH` | bcrypt of seed owner's 6-digit PIN |
| `ADMIN_SESSION_SECRET` | 32-byte random hex (optional cookie-integrity HMAC) |

---

## Storage Schema (full)

### Supabase tables

(In addition to the auth tables above)

```sql
-- ── traffic_events: raw tracker hits, 60-day rolling retention ──
CREATE TABLE traffic_events (
  id            BIGSERIAL    PRIMARY KEY,
  ts            TIMESTAMPTZ  DEFAULT now(),
  vid_hash      TEXT         NOT NULL,    -- SHA-256(visitor_uuid + daily_salt) — see "vid_hash privacy" below
  path          TEXT         NOT NULL,
  product       TEXT,                     -- 'messenger' | 'spy' | 'sentinel' | 'home' | null
  event         TEXT,                     -- null = pageview; otherwise allowlisted event name
  source        TEXT         NOT NULL,    -- 'direct' | 'search' | 'social' | 'utm:twitter' | classified host
  country       TEXT,                     -- 'US' | 'GB' | 'XX' | null
  utm_source    TEXT,
  utm_medium    TEXT,
  utm_campaign  TEXT
);
CREATE INDEX traffic_events_ts        ON traffic_events(ts DESC);
CREATE INDEX traffic_events_product   ON traffic_events(product, ts DESC);
CREATE INDEX traffic_events_event     ON traffic_events(event, ts DESC) WHERE event IS NOT NULL;

-- ── snapshots: cron-written, read-mostly ────────────────────────
CREATE TABLE snapshots (
  key           TEXT         PRIMARY KEY,           -- 'revenue' | 'mrr' | 'subs' | 'users' | 'health' | 'tls' | 'dns' | 'apk' | 'threat_level' | 'headers'
  payload       JSONB        NOT NULL,
  ts            TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ── recent_purchases: Stripe webhook rows, kept forever ────────
CREATE TABLE recent_purchases (
  id              BIGSERIAL    PRIMARY KEY,
  ts              TIMESTAMPTZ  DEFAULT now(),
  product         TEXT         NOT NULL,            -- 'messenger' | 'spy' | 'spy_pro' | 'sentinel' | 'unknown'
  plan            TEXT         NOT NULL,
  amount          INTEGER      NOT NULL,            -- cents
  currency        TEXT         NOT NULL DEFAULT 'usd',
  customer_id     TEXT         NOT NULL,
  hyve_id         TEXT,                             -- if known from session metadata
  stripe_session  TEXT         UNIQUE NOT NULL      -- prevents duplicate webhook delivery
);
CREATE INDEX recent_purchases_ts      ON recent_purchases(ts DESC);
CREATE INDEX recent_purchases_product ON recent_purchases(product, ts DESC);

-- ── failed_payments: Stripe webhook rows, kept forever ─────────
CREATE TABLE failed_payments (
  id              BIGSERIAL    PRIMARY KEY,
  ts              TIMESTAMPTZ  DEFAULT now(),
  customer_id     TEXT         NOT NULL,
  amount          INTEGER      NOT NULL,
  reason          TEXT         NOT NULL,
  stripe_event    TEXT         UNIQUE
);
```

### Vercel KV keys

```
session:<64-hex>            JSON { admin_id, email, role, ip, createdAt, lastActiveAt }   TTL 24h sliding
login_fail:<ip>             integer counter                                                TTL 15m
forgot_pw_rate:<ip>         integer counter (max 3 / 15m)                                  TTL 15m
scan_lock                   '1' while a manual snapshot scan runs                          TTL 30s
```

### `vid_hash` privacy guarantee

The tracker's visitor UUID is hashed with a **daily-rotating salt** before storage. Salt formula:

```
daily_salt = SHA-256(SECRET_SALT || YYYY-MM-DD-utc)
vid_hash   = SHA-256(visitor_uuid || ':' || daily_salt)
```

Properties:
- **Same visitor in same UTC day** → same `vid_hash` → countable as one unique visitor
- **Same visitor across days** → different `vid_hash` → cannot be cross-day correlated
- **Server cannot reverse** the hash to recover the original `visitor_uuid` (one-way SHA-256)
- **Server cannot construct yesterday's hashes** without knowing both `SECRET_SALT` and yesterday's date — and even then only the *next* day's hashes (deriving the salt is one-way)

This is strictly stronger than the HyperLogLog approach used in the prior spec — same uniqueness counting, plus actual anonymization of the visitor identity.

---

## Cron + Tracker + Webhooks

### Tracker (custom, first-party)

**Client-side** (1 KB inline embedded by `app/layout.tsx`):
- Skips `/admin*` paths entirely
- `localStorage['hv_vid']` = random UUID (one-shot per browser)
- Auto-detects `product` from `location.pathname` (`/messenger*` → messenger, `/spy/app/sentinel*` → sentinel, `/spy*` → spy, `/` → home)
- POSTs `{ vid, path, product, referrer, utm, ts }` via `navigator.sendBeacon('/api/track', ...)`
- Exposes `window.hyveTrack(eventName)` for funnel events

**Server-side** `/api/track`:
- Edge runtime (free `x-vercel-ip-country`, sub-50ms)
- Always returns `204 No Content` — silent for tracker, no body, no cookies
- Computes `vid_hash` (see above), classifies `source` (referrer + UTM → label)
- INSERTs row into `traffic_events` via Supabase REST with `Prefer: return=minimal`

**Funnel events** instrumented in existing components:
| Event | Where |
|---|---|
| `pageview` (auto) | every public page |
| `pricing_view` | when pricing section enters viewport (IntersectionObserver) |
| `checkout_open` | onClick of any Stripe checkout button (Messenger Pricing, Spy Pricing, Sentinel checkout) |
| `download_click` | onClick of Android APK download link |
| `report_submit` | after successful POST in `<ReportForm>` |
| `audit_start` | Sentinel audit kicked off |
| `audit_complete` | Sentinel audit finished |

### Cron jobs

`vercel.json`:
```jsonc
{
  "crons": [
    { "path": "/api/cron/snapshot", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/cleanup",  "schedule": "0 * * * *" }
  ]
}
```

`/api/cron/snapshot` (every 5 min):
- Auth: **fail-closed** check `if (!CRON_SECRET || got !== CRON_SECRET) return 401` (the bug we already fixed in `/api/spy/sentinel/purge` — applies here too)
- All snapshots run in `Promise.allSettled` so one failure doesn't poison the rest
- Each subtask has 10s timeout
- For each Stripe price ID env var, sum charges in last 24h / 7d / 30d, count active subs by price_id → produces `snap.byProduct.{messenger,spy,spy_pro,sentinel}` and `snap.total`
- Writes `snapshots(key='revenue', payload=…)` etc.

Subtasks:
1. Stripe rolled-up revenue + per-product breakdown
2. MRR per product
3. Active subs count per product
4. HYVE user count from `hyve-id /v1/stats`
5. Sentinel audit count from Supabase
6. Spy account count from `hyve-api` (pending: confirm endpoint)
7. All-services health pings (relay / hyve-id / hyve-api / Supabase / Stripe) — each `{up, latencyMs}`
8. TLS expiry on `hyveapp.co` (`node:tls`)
9. DoH lookup for A / CNAME / MX / DNSSEC (Cloudflare 1.1.1.1)
10. GitHub releases API for `AnonOrange/hyve-landing` — sum APK download counts
11. Compose threat level from above signals → `snapshots(key='threat_level')`

`/api/cron/cleanup` (hourly):
```sql
DELETE FROM traffic_events       WHERE ts < now() - interval '60 days';
DELETE FROM admin_audit_log      WHERE ts < now() - interval '180 days';
DELETE FROM admin_invites        WHERE expires_at < now() - interval '30 days';
DELETE FROM admin_password_resets WHERE expires_at < now() - interval '30 days';
-- recent_purchases / failed_payments retained forever (business records)
```

### Threat-level computation

| Signal | Severity |
|---|---|
| TLS expires <7d | 30 (CRITICAL) |
| TLS expires <14d | 20 |
| TLS expires <30d | 10 |
| Any service down | 20 |
| Active brute-force lockout | 15 |
| Webhook signature failures in last 24h | 25 |
| DNSSEC not enabled | 5 |
| Cron stale (>15min) | 15 |
| Stripe unreachable | 15 |

Total → `low` (0) | `guarded` (1-9) | `elevated` (10-19) | `high` (20-29) | `critical` (30+)

### Stripe webhooks

**NEW** `/api/stripe/webhook` (Messenger + Spy + Spy Pro):
- Auth: `stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)` — fail-closed, throws on signature mismatch
- `checkout.session.completed`: read `line_items[].price.id`, map to `product` enum (Messenger / Spy / Spy Pro), INSERT into `recent_purchases` with `ON CONFLICT (stripe_session) DO NOTHING`
- `invoice.payment_failed`: INSERT into `failed_payments`
- `customer.subscription.deleted`: trigger immediate `snapshots:subs` recompute (don't wait for cron)
- Always returns 200 to Stripe (idempotent via UNIQUE constraints; failures logged but don't pile up retries)

**UNCHANGED** `/api/spy/sentinel/webhook`:
- Different signing secret (`STRIPE_SENTINEL_WEBHOOK_SECRET`)
- Different blast radius if either secret leaks
- This admin work does not touch it

---

## Dashboard UI

### Visual style

- Dark theme: `#0a0a0a` background, `#131313` panels, `#2a2a2a` borders
- Accent gold `#FFB800` for headings, key numbers, threat banner
- Status: `#39FF14` (ok) / `#FFB800` (warn) / `#ff5555` (fail)
- Monospace for numbers and tables (UI Monospace / SF Mono / Menlo)
- Tactical/SOC-dashboard aesthetic — pulsing dot on threat level, terminal-style separators

### Tab layout

```
┌─────────────────────────────────────────────────────────────┐
│ HYVE · ADMIN          you@email.com  [OWNER badge] · sign out│
├─────────────────────────────────────────────────────────────┤
│ ● THREAT LEVEL: GUARDED       Last scan 2m ago [▶ SCAN NOW]  │  ← sticky
│ 1 active signal · 0 active brute-force lockouts               │
├─────────────────────────────────────────────────────────────┤
│ [Overview]  Financial  Traffic  Users  Security               │
├─────────────────────────────────────────────────────────────┤
│              CONTENT                                          │
└─────────────────────────────────────────────────────────────┘
```

### Tab: Overview

- Top row (4 stat cards): Revenue today / MRR / Active Subs / Visitors today
- Per-product breakdown row (3-4 cards, one per product): Messenger / Spy / Sentinel — each shows revenue, sub count, visitors, conversion%, deep-link to product-specific admin where one exists
- Services strip (one line, 6 service pills): hyve-relay / hyve-id / hyve-api / supabase / stripe / vercel — UP/DOWN + latency

### Tab: Financial

- Revenue cards: today / 7d / 30d (rolled up)
- Per-product revenue table — Messenger / Spy / Spy Pro / Sentinel with monthly + annual + lifetime columns
- MRR sparkline (30-day, hand-rolled SVG)
- Recent purchases table (50 latest across all products) — columns: time, product (color-coded chip), plan, hyveId/customer, amount, status
- Failed payments table (20 latest)

### Tab: Traffic

- Visitors over time (sparkline by day, last 30 days, total)
- **Per-product funnel** (one column per product): pageview → pricing_view → checkout_open → paid, with % at each step
- Top sources (last 7d, ranked)
- Top countries (last 7d, ranked, with regional flag emoji)
- APK download counter per release tag (from GitHub API snapshot)

### Tab: Users

The new piece (multi-admin management). Owner-only mutations.

- **Active admins table** — columns: email, role badge, joined date, last sign-in, actions (Promote to owner / Revoke). "(you)" annotation on own row, no actions on it.
- **Pending invites table** — email, role, invited timestamp, expires in, actions (Resend / Cancel)
- **Audit log** (last 50 actions) — searchable
- **"+ INVITE NEW ADMIN"** button (visible only to owners) opens modal:
  - Email input
  - Role radio (admin / owner)
  - Cancel + Send Invite buttons
- **Revoke confirmation dialog** explains "Their sessions will end immediately and they'll need a fresh invite to return."

### Tab: Security

- Site Command Center (full table — TLS / DNS / DNSSEC / Headers / Brute-force / Disputes / Deploys / Keepalive)
- Brute-force log (live: recent IPs hitting admin login lockout, auto-refresh every 30s)
- Extended admin audit log (searchable, last 500 entries, exportable as JSON)
- Manual scan-now button (bypasses 5-min cron cadence, rate-limited via `scan_lock` 30s KV TTL)

### Existing `/spy/admin` disposition

**Deep-linked from Overview**, contents unchanged. The Spy section card on Overview has a "→ Spy operational admin" link to the existing page. No migration in v1.

---

## API Routes

```
PUBLIC (extends existing — adds the tracker)
  POST /api/track                              ← new, edge runtime, returns 204
  POST /api/stripe/webhook                     ← new, Messenger + Spy + Spy Pro
  (UNCHANGED) POST /api/spy/sentinel/webhook   ← Sentinel-only, separate secret

ADMIN (gated by middleware — KV session + role)
  GET  /admin/login                                ← public form
  GET  /admin/forgot-password                      ← public form
  GET  /admin/reset-password?token=…               ← token-gated public
  GET  /admin/accept-invite?token=…                ← token-gated public
  POST /api/admin/login
  POST /api/admin/logout
  POST /api/admin/forgot-password
  POST /api/admin/reset-password
  POST /api/admin/accept-invite

  GET  /admin                                      ← Overview (owner OR admin)
  GET  /admin/financial                            ← Financial tab
  GET  /admin/traffic                              ← Traffic tab
  GET  /admin/users                                ← User management
  GET  /admin/security                             ← Security tab

  GET  /api/admin/snapshots                        ← all snap:* keys for soft-refresh
  GET  /api/admin/purchases?limit=N                ← recent + failed
  GET  /api/admin/funnel?days=N&product=X
  GET  /api/admin/sources?days=N
  GET  /api/admin/geo?days=N
  GET  /api/admin/security                         ← composed Site Command Center
  GET  /api/admin/users                            ← admin list + invites + audit
  POST /api/admin/scan                             ← manual snapshot trigger, rate-limited
  POST /api/admin/invite                           ← owner-only
  POST /api/admin/revoke                           ← owner-only
  POST /api/admin/set-role                         ← owner-only

INTERNAL (Vercel Cron + Stripe)
  GET  /api/cron/snapshot                          ← Vercel sends GET, fail-closed CRON_SECRET
  GET  /api/cron/cleanup                           ← same
```

---

## Error Handling

- **Cron failures**: `Promise.allSettled` per subtask; failed subtask keeps prior snapshot; `cron_stale` signal raised after 3 consecutive misses (15 min)
- **Supabase unreachable**: dashboard handlers return partial response; missing widgets render `—` placeholder; raises `supabase_down` signal in threat level
- **Stripe API down**: cron retains previous revenue snapshot; recent purchases still update from webhooks (Stripe retries automatically); raises `stripe_unreachable` signal
- **Bad/expired session**: middleware redirects to `/admin/login`; stale session ID silently dropped from KV
- **Tracker `/api/track` errors**: silently swallowed, returns 204 always (don't break public pages over an analytics call)
- **Webhook handler errors**: logged but always 200 to Stripe (idempotent UNIQUE constraints prevent double-processing on retries)

## Testing Strategy

### Unit tests (Vitest)
- `lib/admin/credentials.ts` — bcrypt comparison, generic error messages, all-three-required validation
- `lib/admin/last-owner-guard.ts` — refuses revoke / role-change that would empty `owner` count
- `lib/snapshots/threat-level.ts` — given fixture signals, returns expected level
- `lib/tracker/source.ts` — referrer + UTM permutations classify correctly
- `lib/tracker/vid-hash.ts` — same vid + day → same hash; same vid + different day → different hash; hash is irreversible (sanity)
- `lib/admin/funnel.ts` — per-product rollup correct
- `lib/stripe/webhook-handlers.ts` — fixture events produce expected Supabase inserts

### Integration tests (Vitest + supabase-js mock)
- Login flow: valid creds → cookie set, session in KV
- Login flow: 5 failures → 429 with Retry-After
- Invite flow: owner invites → row in `admin_invites`, email queued
- Accept invite: token → row in `admins`, invite marked used
- Revoke flow: cannot revoke last owner; can revoke non-last
- Forgot password: response is constant regardless of email match
- Tracker: pageview INSERT happens, `vid_hash` is hash-shape

### End-to-end (manual checklist before launch)
- Sign in with seed credentials
- Trigger Stripe test charge for each product → confirm appears in Recent Purchases <5s
- Run "Scan now" → all snapshots refresh
- Drop a TLS cert with 5-day expiry into the snapshot → threat level → CRITICAL
- Visit each public page from incognito → traffic_events row appears with correct product
- Invite new admin → email arrives → click → accept → sign in
- Owner attempts to revoke last owner → 400 with descriptive error

## Deployment / Rollout

### Phase 1: infrastructure
1. Provision admin tables in Supabase (run the CREATE TABLE statements)
2. Generate seed owner password + PIN bcrypt hashes; set `ADMIN_SEED_*` env vars on Vercel
3. Generate `ADMIN_SESSION_SECRET`; set on Vercel
4. Generate `STRIPE_WEBHOOK_SECRET` for the new umbrella webhook (in Stripe Dashboard → Webhooks → Add endpoint at `https://www.hyveapp.co/api/stripe/webhook`, events `checkout.session.completed` + `invoice.payment_failed` + `customer.subscription.deleted`); copy signing secret to Vercel env
5. Add `vercel.json` cron declarations
6. (CRON_SECRET already set as part of the security fix shipped earlier today)

### Phase 2: build + deploy (split into 2 implementation plans)
- **Plan A: backend** (auth + admin user mgmt + tracker + cron + webhook + Supabase migrations)
- **Plan B: dashboard UI** (tabs + components + responsive layout + audit log views)

### Phase 3: validation
- Wait 10 min after first deploy, confirm snapshot rows populated in Supabase
- Sign in with seed credentials
- Invite second admin (e.g., luckybstudios@gmail.com)
- Smoke-test each tab + each owner-only mutation + the last-owner guardrail

### Risk mitigation
- `/admin` route has zero impact on public routes — broken admin cannot affect customer-facing pages
- Tracker is fire-and-forget; if `/api/track` errors, public pages still render
- New umbrella Stripe webhook is additive — Sentinel webhook continues to work unchanged
- Existing `/spy/admin` is untouched

## Open questions / future work (not for v1)

1. **Migrate `/spy/admin` recon/queue UI into umbrella** — separate plan when there's time
2. **TOTP MFA** — schema-wise easy to add (extra `totp_secret` column on `admins`), UI flow is the work
3. **SSO / Google Workspace sign-in** — would require introducing `@supabase/supabase-js` for Supabase Auth or a separate IDP integration
4. **Granular per-product roles** — schema is `admins(role text)`; can grow to a join table `admin_permissions(admin_id, product, scope)` later
5. **Email alerts** on threat-level escalation via Resend
6. **Audit log export to CSV/Parquet** for long-term retention beyond Supabase 180-day window
7. **Per-product activation chains** for the Messenger product (right now Messenger relies on `/api/activate` redirect; webhook completion would close that gap)

## Appendix: cross-reference to retired prior spec

The earlier spec at `2026-04-25-admin-dashboard.md` is **retired**. Components from that work that can be cherry-picked into this build:
- `<AdminShell>`, `<ThreatBanner>`, `<TabNav>`, `<SignOutButton>` — UI chrome (need adjustment for role badge)
- `<StatCard>`, `<HealthStrip>`, `<Sparkline>` — pure presentation, drop-in
- `<PurchasesTable>`, `<FailedPaymentsTable>` — adjust for `product` column
- `<FunnelView>`, `<SourcesList>`, `<GeoList>` — drop-in with Supabase-fed data
- `lib/snapshots/threat-level.ts`, `lib/snapshots/health.ts`, `lib/snapshots/tls.ts`, `lib/snapshots/dns.ts`, `lib/snapshots/github.ts` — pure helpers, drop-in
- `lib/tracker/source.ts` — drop-in
- `scripts/hash-credential.ts` — bcrypt CLI for seed credentials, drop-in

New code:
- All Supabase migration SQL (no overlap with prior KV-only design)
- `lib/admin/credentials.ts` (extend Plan 1's to look up by email in Supabase)
- `lib/admin/session.ts` (similar to Plan 1, but session payload now carries `admin_id` + `role`)
- `lib/admin/invite.ts` + `lib/admin/reset.ts` + `lib/admin/audit.ts` (entirely new)
- `lib/admin/last-owner-guard.ts` (new — guards revoke + role-change)
- `lib/tracker/vid-hash.ts` (new — daily-rotating salt SHA-256)
- All `/admin/*` UI pages and the `<UsersTable>` + `<InviteAdminDialog>` + `<RoleBadge>` + `<AuditLogTable>` components
