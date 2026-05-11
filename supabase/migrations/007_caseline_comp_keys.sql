-- caseline_comp_keys: admin-issued free-trial / comp license keys for
-- Hyve CaseLine. These exist alongside paid licenses (whose source of
-- truth is Stripe subscription metadata). /api/caseline/validate
-- checks Stripe first, then falls through to this table.
--
-- Revocation is soft (a timestamp + reason on an existing row, not a
-- DELETE) so we can prove WHEN a key was killed in a future dispute.
-- The desktop client's validate handler shows a "your access has been
-- revoked" banner but continues the active session until next cold
-- start (per Q3-c — soft revoke).
--
-- Schema columns are intentionally a superset of what the issuance UI
-- requires today. `label`, `revoked_reason`, `revoked_by` are optional
-- now; the columns exist so we can backfill or expose them later
-- without a migration.

create table if not exists caseline_comp_keys (
  key                text         primary key,
  -- Tier mirrors the Stripe license tier so downstream code paths
  -- (seat math, UI labels) don't need a special case for comp keys.
  tier               text         not null check (tier in ('5', '10', 'custom')),
  max_seats          int          not null check (max_seats > 0),
  -- Free-form label for the admin's own records. e.g. "Internal QA",
  -- "Bar Association beta", "Investor demo - John Smith".
  label              text,
  -- Who issued it (admin email from the session). Required.
  issued_by          text         not null,
  issued_at          timestamptz  not null default now(),
  -- Soft-delete: null = active, populated = revoked-at-this-time.
  revoked_at         timestamptz,
  revoked_by         text,
  revoked_reason     text,
  -- Useful telemetry for the admin UI ("last seen 3 hours ago"). Updated
  -- by the validate endpoint on each successful poll.
  last_validated_at  timestamptz
);

-- Most validate-endpoint lookups will filter to active keys. Partial
-- index keeps the hot path scan-free.
create index if not exists idx_caseline_comp_keys_active
  on caseline_comp_keys (key)
  where revoked_at is null;

-- Reverse index for the admin UI's "show all keys ever issued" view —
-- ordered newest-first.
create index if not exists idx_caseline_comp_keys_issued_at
  on caseline_comp_keys (issued_at desc);

-- Note: the existing admin_audit_log table (from migration 001) is
-- reused for issue/revoke events. We don't need a separate audit table.
