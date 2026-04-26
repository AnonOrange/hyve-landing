# HYVE Admin Dashboard — Design Spec

**Project:** hyveapp.co admin panel
**Status:** Approved during brainstorming session 2026-04-25
**Owner:** vibesoftwaresolutions@gmail.com
**Repo:** `AnonOrange/hyve-landing` (Next.js app on Vercel)

---

## Overview

### What

A protected `/admin` section of hyveapp.co (same Next.js app, no subdomain) that gives the sole site operator a single-pane-of-glass view of:

- **Money** — Stripe revenue / MRR / active subs / recent purchases / failed payments
- **Traffic** — visitor counts, conversion funnel, top sources, geography (collected via a custom first-party tracker; **no third-party analytics**)
- **Infrastructure** — server health (hyve-relay, hyve-id, Vercel, Stripe), APK download counts, registered HYVE-ID accounts and premium count
- **Site Command Center** — an OVERLORD-styled real-time security dashboard for hyveapp.co itself: TLS expiry, DNS / DNSSEC, security headers, brute-force defense, Stripe disputes, deploy log, keepalive status

### Why

1. **Visibility into the business** — currently the operator has no place to see daily revenue, conversion rate, or where paying customers come from. Decisions about marketing, pricing, and feature investment require this data.
2. **Visibility into the system** — the operator currently has no way to know if the relay or ID server has gone down (until users complain). Site Command Center makes failures visible immediately.
3. **First-party data ownership** — HYVE markets itself on privacy. Every analytics SaaS would create a credibility tension. Building a custom lightweight tracker keeps every visitor's data inside the operator's own infrastructure.
4. **Cyberdefense posture** — the existing HYVE OVERLORD desktop product cannot serve as the website's defense (it's local-only). A native Site Command Center inside the admin panel fills that gap.

### Success criteria

- Operator opens `/admin` after sign-in and sees within <100ms: today's revenue, MRR, visitor count, threat level, and any active security signals
- Stripe purchases appear in "Recent purchases" within ~2 seconds of payment (via Stripe webhook)
- Site Command Center surfaces a TLS expiry warning ≥30 days before the cert dies
- Traffic source attribution survives without cookies, third parties, or PII
- Brute-force admin login attempts are auto-blocked after 5 failures from a single IP within 15 minutes

### Out of scope (deliberately, for v1)

- Multi-admin accounts (single operator only — the schema doesn't preclude adding it later)
- Full Stripe customer management (refunds / cancellations require going to Stripe directly)
- Real-time websocket updates (5-min cron freshness is enough for this use case)
- Mobile-optimized admin UI (desktop-first; viewport ≥1024px assumed)
- The public-site refresh — that's a separate sub-project to be brainstormed after admin ships

---

## Architecture

### High-level

```
┌─────────────────────────────────────────────────────────────┐
│  hyveapp.co (Next.js on Vercel — single app)                │
│                                                              │
│  PUBLIC routes ──────────────┐  ADMIN routes ───────────────┤
│  /, /pricing, /download,     │  /admin/login                │
│  /privacy, /app, /whitepaper │  /admin (dashboard)          │
│                              │  /admin/customers,           │
│  + 1-line tracker JS         │  /admin/security             │
│      ↓                       │                              │
│  /api/track POST ────────────┤  middleware.ts (auth check)  │
│  (writes to Vercel KV)       │      ↓                       │
│                              │  /api/admin/* (read KV)      │
└─────────────────────────────────────────────────────────────┘
              │                          ↑
              ↓                          │
┌─────────────────────────────────────────────────────────────┐
│  Vercel KV (Redis)                                          │
│                                                              │
│  ▸ pageview/source/geo counters by date                     │
│  ▸ funnel events (rolling 30d)                              │
│  ▸ snap:* keys (revenue, mrr, subs, health, tls, dns…)      │
│  ▸ recent_purchases / failed_payments (sorted sets)         │
│  ▸ session:* (24h TTL)                                      │
│  ▸ login_fail:<ip> (15m TTL)                                │
│  ▸ snap:threat_level                                        │
└─────────────────────────────────────────────────────────────┘
              ↑                          ↑
              │                          │
┌─────────────┴──────────────────────────┴────────────────────┐
│  Vercel Cron (declared in vercel.json)                      │
│                                                              │
│  every 5 min → /api/cron/snapshot                           │
│     ↳ pull live revenue/MRR from Stripe                     │
│     ↳ pull HYVE-ID user counts from /v1/stats               │
│     ↳ ping hyve-relay /health, hyve-id /health              │
│     ↳ TLS expiry check on hyveapp.co                        │
│     ↳ DoH lookup of A/CNAME/MX/DNSSEC                       │
│     ↳ pull APK download count from GitHub releases API      │
│     ↳ compute threat level from above signals               │
│                                                              │
│  every hour → /api/cron/cleanup                             │
│     ↳ trim recent_purchases / failed_payment to 50/20       │
│     ↳ rotate stale sessions                                 │
└─────────────────────────────────────────────────────────────┘
              ↑
              │  hits webhook on payment events
┌─────────────┴───────────────────────────────────────────────┐
│  Stripe → /api/stripe/webhook (extends existing route)      │
│  • checkout.session.completed → ZADD recent_purchases       │
│  • invoice.payment_failed → ZADD failed_payment             │
│  • customer.subscription.deleted → recompute snap:subs      │
└─────────────────────────────────────────────────────────────┘
```

### Key design decisions (locked during brainstorm)

| Decision | Choice | Why |
|---|---|---|
| Hosting | `/admin` route on existing Next.js app | Single deploy, no DNS work, simplest |
| Analytics provider | Custom first-party tracker | Privacy ownership; matches HYVE's brand promise |
| Storage | Vercel KV (Redis) only | Fits the data shapes (counters, sorted sets, HLL); free tier covers expected volume |
| Cron strategy | Vercel Cron, every 5 min snapshots | Dashboard always fast; no rate-limit risk; standard pattern |
| Real-time path | Stripe webhook → KV writes | Purchases appear in ~2s; zero polling cost |
| Auth | password + static 6-digit PIN, both bcrypt-hashed in env vars | User's request; better than password-only without TOTP setup overhead |
| Session model | Opaque session ID in `__Host-` cookie, looked up in KV with 24h sliding TTL | Standard, simple, revocable |
| OVERLORD integration | Native Site Command Center inspired by OVERLORD; OVERLORD desktop app stays separate | OVERLORD is local-only; the site needs an always-on defense layer |
| UI structure | Tabbed: Overview / Money / Traffic / Security / Users + sticky threat banner | Keeps each tab focused; threat banner reinforces the command-center feel |

---

## Data Layer

### Vercel KV key schema

All keys namespaced. Format: `<entity>:<id-or-bucket>`.

```
SESSIONS
  session:<32-byte-hex-id>     → JSON { email, createdAt, lastActiveAt, ip }    TTL 24h
  login_fail:<ip>              → integer counter                                  TTL 15m

ADMIN SNAPSHOTS (overwritten every 5 min by cron)
  snap:revenue                 → { today, week, month, deltaToday, ts }
  snap:mrr                     → { current, history: [{date, mrr}…30 daily], ts }
  snap:subs                    → { monthly, annual, lifetime, total, ts }
  snap:hyve_users              → { total, premium, signups_today, signups_7d, ts }
  snap:apk_downloads           → { total, today, releases: [{tag, count}], ts }
  snap:server_health           → { relay: {up, latencyMs, since}, hyveId, vercel, stripe, ts }
  snap:tls                     → { hyveapp: {expiresAt, daysLeft, issuer}, ts }
  snap:dns                     → { hyveapp_a, www_cname, mx, dnssec, ts }
  snap:threat_level            → { level: 'low|guarded|elevated|high|critical', signals: […], ts }

REAL-TIME (Stripe webhook writes these)
  recent_purchases             → SORTED SET, score = unix-ts, member = JSON {hyveId, plan, amount, currency, customerId}
                                 — TRIMMED to 50 latest by hourly cleanup
  failed_payments              → SORTED SET, score = unix-ts, member = JSON {customerId, amount, reason}
                                 — TRIMMED to 20 latest

TRACKER (written by /api/track, read by dashboard)
  pv:<YYYYMMDD>                → integer pageviews for that UTC day               TTL 60d
  uv:<YYYYMMDD>                → HyperLogLog of visitor IDs (PFADD)               TTL 60d
  source:<YYYYMMDD>:<source>   → integer per-source counter                       TTL 60d
  geo:<YYYYMMDD>:<country>     → integer per-country counter                      TTL 60d
  funnel:<YYYYMMDD>:<step>     → integer (pageview/pricing_view/checkout/paid)    TTL 60d

OPS
  scan_lock                    → "1" while a manual scan runs                     TTL 30s
```

### Memory budget

Steady-state KV memory: **<1 MB**. Vercel KV free tier provides 256 MB.

### HyperLogLog for unique visitors

Unique visitor counts use Redis `PFADD` / `PFCOUNT` rather than a Set. HLL provides ~0.81% error using ~12 KB regardless of cardinality. A naive Set would grow to MBs per day at moderate traffic.

---

## Auth & Sessions

### Login flow

1. User opens `GET /admin/login` — form fields: email, password, 6-digit PIN.
2. Form POSTs to `/api/admin/login`.
3. Server verifies all three:
   - `email === ADMIN_EMAIL`
   - `bcrypt.compare(password, ADMIN_PASSWORD_HASH)`
   - `bcrypt.compare(pin, ADMIN_PIN_HASH)`
4. On any failure → `401 { error: 'Invalid credentials' }` (don't disclose which field failed).
5. On success:
   - Generate 32-byte random session ID via `crypto.randomBytes(32).toString('hex')`
   - Store `session:<id>` in KV with `{ email, createdAt: now, lastActiveAt: now, ip }`, TTL 24h
   - Set cookie `__Host-admin_session=<id>; HttpOnly; Secure; SameSite=Strict; Path=/`
   - Redirect to `/admin`

### Middleware (one auth check, applies to every admin route)

```ts
// middleware.ts
export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}

export async function middleware(req: NextRequest) {
  // Allow login page itself without session
  if (req.nextUrl.pathname === '/admin/login' ||
      req.nextUrl.pathname === '/api/admin/login') {
    return NextResponse.next()
  }

  const sid = req.cookies.get('__Host-admin_session')?.value
  if (!sid) return redirectToLogin(req)

  const session = await kv.get(`session:${sid}`)
  if (!session) return redirectToLogin(req)

  // Sliding TTL refresh
  await kv.expire(`session:${sid}`, 24 * 60 * 60)
  return NextResponse.next()
}
```

### Anti-brute-force

- Track failed logins in KV: `login_fail:<ip>`, INCR on each failure, TTL 15 min.
- After 5 failures → `429 Too Many Requests` with `Retry-After: 900`.
- Successful login resets the counter.

### CSRF

- `SameSite=Strict` cookie + `Origin` header check on POST routes is sufficient for a single-admin panel.
- No CSRF tokens needed.

### Logout

- `POST /api/admin/logout` → `kv.del(session:${sid})` + clear cookie + redirect to `/admin/login`.

---

## Cron Jobs

### `vercel.json` schedule

```jsonc
{
  "crons": [
    { "path": "/api/cron/snapshot", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/cleanup",  "schedule": "0 * * * *" }
  ]
}
```

### `/api/cron/snapshot` (every 5 min)

Each step has a 10s timeout. All run in parallel (`Promise.allSettled`); a single failed step doesn't block others. Failed steps keep the previous snapshot.

```
1. Stripe.charges.list + Stripe.subscriptions.list   → snap:revenue, snap:mrr, snap:subs
2. fetch hyve-id /v1/stats                            → snap:hyve_users
3. fetch hyve-relay /health (timed)                   → snap:server_health.relay
4. fetch hyve-id /health (timed)                      → snap:server_health.hyveId
5. tls.connect to hyveapp.co:443, read peer cert      → snap:tls
6. fetch DoH (cloudflare) for A/CNAME/MX/DNSSEC       → snap:dns
7. fetch GitHub /repos/AnonOrange/hyve-landing/releases → snap:apk_downloads
8. compute threat level from above                    → snap:threat_level
```

### Threat-level computation

| Signal | Severity contribution |
|---|---|
| TLS cert expires in <7d | +30 (CRITICAL) |
| TLS cert expires in <14d | +20 (HIGH) |
| TLS cert expires in <30d | +10 (ELEVATED) |
| Any server health check failed | +20 |
| Active brute-force lockout | +15 |
| Stripe webhook signature failures in last 24h | +25 |
| DNSSEC not enabled | +5 |
| 0 successful keepalive pings in last 30 min | +20 |

```
Total severity → level
   0          → low
   1-9        → guarded
  10-19       → elevated
  20-29       → high
  30+         → critical
```

### `/api/cron/cleanup` (hourly)

- `ZREMRANGEBYRANK recent_purchases 0 -51` — keep latest 50.
- `ZREMRANGEBYSCORE recent_purchases 0 (now - 30d)` — drop entries older than 30 days.
- Same for `failed_payments` (keep 20).
- Daily counters self-expire via TTL; nothing to do.

### Cron protection

Vercel automatically signs cron requests with a header `Authorization: Bearer ${CRON_SECRET}`. Cron handlers verify this header and reject any other caller.

---

## Tracker & Public Site Instrumentation

### Client-side tracker

Single inline script via `app/layout.tsx`, ~1 KB minified.

**Behavior:**
1. Read or create `localStorage['hv_vid']` — anonymous random UUID.
2. On page load, POST `{ vid, path, referrer, utm, ts }` to `/api/track` via `navigator.sendBeacon`.
3. Expose `window.hyveTrack(eventName)` for funnel events.

**Privacy guarantees enforced:**
- No cookies set by the tracker
- No third-party domains contacted
- No fingerprinting (only the localStorage UUID, which is on the user's own device)
- No keystrokes / mouse movements / scroll heatmaps captured
- IP addresses never persisted server-side (only the country code derived from edge headers)
- Visitor ID is stored server-side ONLY as a HyperLogLog token (not reversible)

### Funnel events

Instrumented inside existing components by adding `onClick={() => window.hyveTrack('event_name')}`:

| Event name | Where | Trigger |
|---|---|---|
| `pageview` | every public page | tracker auto-fires |
| `pricing_view` | `<PricingSection>` | IntersectionObserver fires when section enters viewport |
| `checkout_open` | `<PricingSection>` | onClick of any "Get Pro" / "Annual" / "Lifetime" button |
| `download_click` | `<DownloadSection>` | onClick of "Download Android APK" |
| `report_submit` | `<ReportForm>` | after successful POST |

Note: the `paid` step in the funnel is not a tracker event — it's counted separately from the Stripe webhook firing `checkout.session.completed`.

### `/api/track` server endpoint

- Runtime: `edge` (free, fast, gets `x-vercel-ip-country` header automatically)
- Returns `204 No Content` always — no body, no cookies, no error responses (silent for the tracker)
- Body validation: drop malformed payloads silently
- For pageviews: INCR `pv:<date>`, PFADD `uv:<date>`, INCR `geo:<date>:<country>`, INCR `source:<date>:<classified-source>`, INCR `funnel:<date>:pageview`
- For events: INCR `funnel:<date>:<event>` (only if event is in the allowlist)

### Source classification

Collapse thousands of referrers into ~10 buckets:
- `utm_source` query param wins if present → `utm:<source>`
- No referrer → `direct`
- Referrer host matches search engines → `search`
- Referrer host matches social platforms → `social`
- Otherwise → the host itself (truncated to 40 chars)

### Privacy banner

**None required.** No cookies set, no third-party trackers loaded, no PII collected. The localStorage UUID is on the user's device. This satisfies GDPR's "strictly necessary" exemption from consent.

The privacy policy page will be updated to mention: *"Anonymous, country-level analytics. No cookies, no third parties, no IP storage. Visitor counts use HyperLogLog — a math trick that knows the count of unique visitors without knowing who any of them are."*

---

## Site Command Center

### What it watches

| Check | How | Cron interval |
|---|---|---|
| TLS cert expiry | `tls.connect()` to hyveapp.co:443, read peer cert | 5 min |
| DNS A record | DoH GET to Cloudflare 1.1.1.1 for A record of hyveapp.co | 5 min |
| DNS CNAME (www) | Same, for www.hyveapp.co | 5 min |
| MX records | Same, for hyveapp.co MX | 5 min |
| DNSSEC enabled | DoH query with DNSSEC flag, look for AD bit | 5 min |
| Security headers | HEAD request to hyveapp.co/, parse HSTS / CSP / X-Frame / Referrer-Policy | 5 min |
| Brute-force admin attempts | KV scan for `login_fail:*` keys with count ≥ 5 | on read |
| Stripe disputes (last 30d) | `Stripe.disputes.list` | 5 min |
| Vercel deploy status | Vercel API `/v6/deployments` for last build | 5 min |
| Relay keepalive | Last GitHub Actions run for `relay-keepalive.yml` | 5 min |

### UI

- Overview tab: top 3 active signals only + "see Security tab →" link
- Security tab: full table with color-coded status pill per row (✓ ok / ⚠ warn / ✗ fail)
- "SCAN NOW" button bypasses cron, runs all checks fresh, returns within 10s. Rate-limited to 1 scan / 30s via `scan_lock` in KV.

---

## Dashboard UI

### Visual style

- **Theme:** Dark (background `#0a0a0a`, panels `#131313`, borders `#2a2a2a`)
- **Accent:** HYVE gold `#FFB800` for headings, key numbers, the threat banner
- **Status colors:** `#39FF14` (ok / up), `#FFB800` (warn), `#ff5555` (fail)
- **Typography:** Monospace for numbers and table data (UI Monospace / SF Mono / Menlo). Sans for prose.
- **Aesthetic:** Tactical / cyberdefense / SOC dashboard. Pulsing dot on threat level. Terminal-style separators (`━━ SECTION ━━`). Tight density.

### Layout

```
┌────────────────────────────────────────────────────────┐
│ HYVE · ADMIN              email · sign out              │
├────────────────────────────────────────────────────────┤
│ ● THREAT LEVEL: ELEVATED       [▶ SCAN NOW]            │  ← sticky
│ 2 active signals · last scan 2m ago                     │
├────────────────────────────────────────────────────────┤
│ [Overview] Money  Traffic  Security 🔴2  Users          │  ← tabs
├────────────────────────────────────────────────────────┤
│                                                         │
│                  CONTENT FOR SELECTED TAB               │
│                                                         │
└────────────────────────────────────────────────────────┘
```

### Tab contents

**Overview** (default landing)
- 3 cards: Revenue today / MRR / Active Subs
- 3 cards: Visitors today / HYVE Users / APK Downloads
- Active Security Signals (top 3 only) → link to Security tab
- Server Health strip (one-line per service: relay / hyve-id / vercel / stripe)

**Money**
- Revenue cards: today / 7d / 30d
- MRR chart (30-day sparkline)
- Active subs breakdown (monthly / annual / lifetime)
- Recent purchases table (50 most recent — time, hyveId, plan, amount, status)
- Failed payments table (20 most recent)

**Traffic**
- Visitors over time chart (30 day)
- Conversion funnel (pageview → pricing_view → checkout_open → paid) with % at each step
- Top sources (last 7 days)
- Top countries (last 7 days)
- APK download counter with daily breakdown

**Security**
- Full Site Command Center expanded
- All checks listed with status pill, last-checked timestamp, detail line
- Brute-force log (recent IPs that hit lockout)
- Deploy log (last 10 Vercel deploys)
- "SCAN NOW" button at top

**Users**
- HYVE-ID account list (paginated, search by handle)
- Premium accounts subtab
- "Grant Pro" / "Grant Lifetime" / "Revoke Pro" actions per account (calls existing `/api/admin/grant` route, which uses HYVE_ADMIN_KEY to call hyve-id)

---

## API Routes

```
PUBLIC (extends existing routes)
  POST /api/track                        ← new, edge runtime, returns 204
  POST /api/stripe/webhook               ← extended to write recent_purchases / failed_payments

ADMIN (gated by middleware)
  GET  /admin/login                      ← login form page (public)
  POST /api/admin/login                  ← verify creds + create session
  POST /api/admin/logout                 ← destroy session
  GET  /admin                            ← Overview tab
  GET  /admin/money                      ← Money tab
  GET  /admin/traffic                    ← Traffic tab
  GET  /admin/security                   ← Security tab
  GET  /admin/users                      ← Users tab
  GET  /api/admin/snapshots              ← returns all snap:* keys (used by Overview)
  GET  /api/admin/funnel?days=N          ← returns funnel data for last N days
  GET  /api/admin/sources?days=N         ← returns source breakdown
  GET  /api/admin/purchases              ← returns recent_purchases sorted set
  GET  /api/admin/security               ← returns full command center state
  POST /api/admin/scan                   ← manual command center refresh, rate-limited
  POST /api/admin/grant                  ← grants Pro/lifetime to a HYVE ID via hyve-id

INTERNAL (called by Vercel Cron only)
  POST /api/cron/snapshot                ← 5-min snapshot job
  POST /api/cron/cleanup                 ← hourly cleanup
```

---

## Environment variables (Vercel production)

| Var | Purpose | Set how |
|---|---|---|
| `ADMIN_EMAIL` | The single admin's email (login check) | `vercel env add` |
| `ADMIN_PASSWORD_HASH` | bcrypt hash of admin password | bcrypt locally, paste hash via `vercel env add` |
| `ADMIN_PIN_HASH` | bcrypt hash of 6-digit PIN | same as above |
| `ADMIN_SESSION_SECRET` | 32-byte random hex (HMAC for cookie integrity, optional) | `openssl rand -hex 32` |
| `KV_REST_API_URL` | Vercel KV endpoint | auto-set when KV is provisioned |
| `KV_REST_API_TOKEN` | Vercel KV auth token | auto-set when KV is provisioned |
| `KV_REST_API_READ_ONLY_TOKEN` | Read-only KV token | auto-set when KV is provisioned |
| `CRON_SECRET` | Vercel-signed cron auth | auto-set; check via header in cron handlers |
| `STRIPE_SECRET_KEY` | already set | n/a |
| `STRIPE_WEBHOOK_SECRET` | needed for webhook signature verification | `vercel env add` if not already set |
| `HYVE_ADMIN_KEY` | already set | n/a |
| `HYVE_ID_BASE_URL` | optional override (defaults to live URL) | already set in fallback |

---

## Error handling

### Cron job failures
- Each step in `/api/cron/snapshot` is wrapped in try/catch. Failures logged to Vercel function logs; previous snapshot stays in KV.
- If 3 consecutive cron runs fail (15-min gap with no fresh snapshot), the threat level computation flags it as `signal: cron_stale` — visible in the dashboard.

### KV unreachable
- Dashboard handlers return a partial response with whatever snapshots they could read. Missing widgets show a "—" placeholder rather than crashing.
- Tracker `/api/track` silently swallows errors (it returns 204 anyway).

### Stripe API down
- Cron snapshot retains previous revenue/MRR. Threat level adds `signal: stripe_unreachable`.
- Recent purchases table still updates from webhooks (which Stripe retries automatically).

### Bad session
- Middleware redirects to `/admin/login`. Stale session ID is silently dropped.

---

## Testing strategy

### Unit tests (Vitest)
- `lib/auth/verify-credentials.ts` — bcrypt comparison logic, generic error message, all-three-required validation
- `lib/threat-level/compute.ts` — given fixture signals, returns expected level
- `lib/tracker/classify-source.ts` — referrer + utm permutations
- `lib/kv/snapshot-shapes.ts` — snapshot read returns expected shape, handles missing keys

### Integration tests (Vitest + ioredis-mock or Vercel KV emulator)
- Login flow: valid creds → cookie set, session in KV
- Login flow: invalid creds → 401, login_fail counter incremented
- Login flow: 5 failures → 429
- Tracker: pageview increments counters and HLL
- Cron snapshot: with mocked Stripe + DoH, writes correct snap:* keys
- Stripe webhook: `checkout.session.completed` → ZADD recent_purchases

### End-to-end (manual checklist before launch)
- Sign in with real credentials
- Push a test purchase via Stripe Checkout test mode → confirm appears in Recent Purchases <5s
- Run "SCAN NOW" → confirm all checks return ✓
- Drop a TLS cert with 5-day expiry into the snapshot → confirm threat level goes to CRITICAL
- Visit hyveapp.co from incognito → confirm visitor count incremented in KV

---

## Deployment / rollout

### Phase 1: infrastructure
1. Provision Vercel KV in the hyve-landing project
2. Generate password + PIN bcrypt hashes locally; set as env vars on Vercel production
3. Generate `ADMIN_SESSION_SECRET`; set on Vercel
4. Add `vercel.json` cron declarations
5. Add `STRIPE_WEBHOOK_SECRET` if missing

### Phase 2: build + deploy
1. Implement tracker (client + server)
2. Implement auth + middleware
3. Implement cron snapshot + cleanup jobs
4. Implement dashboard tabs (Overview → Money → Traffic → Security → Users)
5. Extend Stripe webhook with new handlers
6. Add `/v1/stats` endpoint to hyve-id (returns `{ total, premium, signups_today, signups_7d }`)
7. Deploy to Vercel preview, smoke test
8. Promote to production

### Phase 3: validation
- Wait 15 min, verify snapshot keys populated in KV (Vercel KV dashboard)
- Sign in, exercise each tab
- Trigger a real Stripe test charge, watch Recent Purchases update
- Verify GitHub Actions keepalive workflow shows up in Security tab

### Risk mitigation during rollout
- The `/admin` route has zero impact on public routes. Even a totally broken `/admin` cannot affect customer-facing pages.
- The tracker is fire-and-forget; if its endpoint errors, public pages still render.
- New Stripe webhook handlers are additive — existing activation flow continues to work.

---

## Open questions / future work (not for v1)

1. **Multi-admin** — schema already supports it (move email check to a list, store admin records in KV). Defer until needed.
2. **Email alerts on threat-level change** — could fire a Resend email when level escalates above a threshold. Not in v1 scope.
3. **Audit log** — every admin action logged with timestamp, IP, action. Useful for compliance, not strictly needed for solo operator.
4. **Real-time updates** — replace polling with Server-Sent Events for the Recent Purchases table. Nice-to-have, not blocking.
5. **Mobile admin** — current design is desktop-first; mobile responsiveness is out of scope for v1 but layout is grid-based so it could degrade gracefully later.

---

## Appendix: visual references

Mockups produced during brainstorming:
- `.superpowers/brainstorm/<session>/dashboard-layout.html` — single-page version (rejected in favor of tabs)
- `.superpowers/brainstorm/<session>/dashboard-layout-v2.html` — final tabbed version (approved)

Both files are gitignored (project-local) but persist for future reference if the design needs revisiting.
