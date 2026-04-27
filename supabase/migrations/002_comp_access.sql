-- ─────────────────────────────────────────────────────────────────────────────
-- 002_comp_access.sql
-- Run in the Supabase SQL editor (or via supabase db push).
-- Adds the comp-access allowlist table — admin-managed list of emails
-- granted free lifetime Pro access to Hyve Spy. Read by /api/spy/sign-in
-- to mint a `comp:<email>` session cookie which verify-session recognizes
-- as tier=pro indefinitely.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS comp_access_emails (
  email      TEXT         PRIMARY KEY,
  granted_by TEXT         NOT NULL,        -- admin email who granted
  granted_at TIMESTAMPTZ  DEFAULT now(),
  notes      TEXT,                          -- optional context (e.g. "podcast guest", "beta tester")
  active     BOOLEAN      NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS comp_access_active
  ON comp_access_emails(email) WHERE active = true;

-- Service role bypasses RLS via SUPABASE_SERVICE_KEY; enable RLS to block
-- accidental anon-key exposure.
ALTER TABLE comp_access_emails ENABLE ROW LEVEL SECURITY;
