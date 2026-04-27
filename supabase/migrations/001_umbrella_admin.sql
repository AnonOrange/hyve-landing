-- ─────────────────────────────────────────────────────────────────────────────
-- 001_umbrella_admin.sql
-- Run once in the Supabase SQL editor (or via supabase db push).
-- Creates all tables for the umbrella admin dashboard.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Admin users ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admins (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT         UNIQUE NOT NULL,
  password_hash TEXT         NOT NULL,
  pin_hash      TEXT         NOT NULL,
  role          TEXT         NOT NULL CHECK (role IN ('owner', 'admin')),
  invited_by    UUID         REFERENCES admins(id),
  invited_at    TIMESTAMPTZ  DEFAULT now(),
  accepted_at   TIMESTAMPTZ  NOT NULL,
  last_login_at TIMESTAMPTZ,
  active        BOOLEAN      NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS admins_email_active ON admins(email) WHERE active = true;

-- ── Outstanding invite tokens ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_invites (
  token       TEXT         PRIMARY KEY,
  email       TEXT         NOT NULL,
  role        TEXT         NOT NULL CHECK (role IN ('owner', 'admin')),
  invited_by  UUID         NOT NULL REFERENCES admins(id),
  invited_at  TIMESTAMPTZ  DEFAULT now(),
  expires_at  TIMESTAMPTZ  NOT NULL,
  used_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS admin_invites_email_open ON admin_invites(email) WHERE used_at IS NULL;

-- ── Password reset tokens (1h expiry) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_password_resets (
  token        TEXT         PRIMARY KEY,
  admin_id     UUID         NOT NULL REFERENCES admins(id),
  requested_at TIMESTAMPTZ  DEFAULT now(),
  expires_at   TIMESTAMPTZ  NOT NULL,
  used_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS admin_password_resets_admin_open
  ON admin_password_resets(admin_id) WHERE used_at IS NULL;

-- ── Append-only admin action log ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id           BIGSERIAL    PRIMARY KEY,
  ts           TIMESTAMPTZ  DEFAULT now(),
  actor_email  TEXT         NOT NULL,
  action       TEXT         NOT NULL,
  target_email TEXT,
  detail       TEXT,
  ip           TEXT
);
CREATE INDEX IF NOT EXISTS admin_audit_log_ts ON admin_audit_log(ts DESC);

-- ── First-party traffic events (rolling 60-day) ───────────────────────────────
CREATE TABLE IF NOT EXISTS traffic_events (
  id           BIGSERIAL    PRIMARY KEY,
  ts           TIMESTAMPTZ  DEFAULT now(),
  vid_hash     TEXT         NOT NULL,
  path         TEXT         NOT NULL,
  product      TEXT,
  event        TEXT,
  source       TEXT         NOT NULL,
  country      TEXT,
  utm_source   TEXT,
  utm_medium   TEXT,
  utm_campaign TEXT
);
CREATE INDEX IF NOT EXISTS traffic_events_ts      ON traffic_events(ts DESC);
CREATE INDEX IF NOT EXISTS traffic_events_product ON traffic_events(product, ts DESC);
CREATE INDEX IF NOT EXISTS traffic_events_event
  ON traffic_events(event, ts DESC) WHERE event IS NOT NULL;

-- ── Cron-written snapshot store ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS snapshots (
  key     TEXT         PRIMARY KEY,
  payload JSONB        NOT NULL,
  ts      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ── Stripe purchase records (kept forever) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS recent_purchases (
  id             BIGSERIAL    PRIMARY KEY,
  ts             TIMESTAMPTZ  DEFAULT now(),
  product        TEXT         NOT NULL,
  plan           TEXT         NOT NULL,
  amount         INTEGER      NOT NULL,
  currency       TEXT         NOT NULL DEFAULT 'usd',
  customer_id    TEXT         NOT NULL,
  hyve_id        TEXT,
  stripe_session TEXT         UNIQUE NOT NULL
);
CREATE INDEX IF NOT EXISTS recent_purchases_ts      ON recent_purchases(ts DESC);
CREATE INDEX IF NOT EXISTS recent_purchases_product ON recent_purchases(product, ts DESC);

-- ── Failed payment records (kept forever) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS failed_payments (
  id          BIGSERIAL    PRIMARY KEY,
  ts          TIMESTAMPTZ  DEFAULT now(),
  customer_id TEXT         NOT NULL,
  amount      INTEGER      NOT NULL,
  reason      TEXT         NOT NULL,
  stripe_event TEXT        UNIQUE
);
CREATE INDEX IF NOT EXISTS failed_payments_ts ON failed_payments(ts DESC);

-- ── Row-level security: service role bypass ───────────────────────────────────
-- All reads/writes from the Next.js backend use SUPABASE_SERVICE_KEY which
-- bypasses RLS. Enable RLS to block accidental anon-key exposure, but
-- explicitly grant the service role full access so our queries still work.
ALTER TABLE admins             ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_invites      ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_password_resets ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log    ENABLE ROW LEVEL SECURITY;
ALTER TABLE traffic_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshots          ENABLE ROW LEVEL SECURITY;
ALTER TABLE recent_purchases   ENABLE ROW LEVEL SECURITY;
ALTER TABLE failed_payments    ENABLE ROW LEVEL SECURITY;
