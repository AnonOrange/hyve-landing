-- ─────────────────────────────────────────────────────────────────────────────
-- 004_sleuth_scans.sql
-- Hyve Sleuth — nationwide OSINT scan queue + person-centric result store.
--
-- Architecture (mirrors residential, but person-shaped):
--   1. POST /api/sleuth/scan inserts a row in sleuth_scan_jobs (status='pending')
--   2. hyve-sleuth-worker (Railway, separate from residential worker) polls
--      the queue and fans each scan to N OSINT adapters in parallel:
--        - HIBP (email → breaches)
--        - GITHUB (username → public profile + repos)
--        - GRAVATAR (email → gravatar)
--        - SHERLOCK (username → 300+ social sites)
--        - OPENCORPORATES (name → business records)
--        - USPTO (name → patents/trademarks)
--        - FAA (name → airman / pilot license)
--        - NSOPW (name+state → sex offender registry)
--   3. Adapters write findings to the canonical sleuth_* tables
--   4. UI polls GET /api/sleuth/scan/:id for status + per-source progress
--
-- Person dedup is intentionally loose: each adapter generates its own
-- person_id (stable hash) — the UI groups hits by query + clusters by
-- shared identifiers (email match, name+state match) at read time. OSINT
-- doesn't have canonical person IDs across sources; we surface all hits
-- and let the investigator decide which are "the same person".
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sleuth_scan_jobs (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email      TEXT         NOT NULL,
  status          TEXT         NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','running','completed','failed','cancelled')),
  query_type      TEXT         NOT NULL
                  CHECK (query_type IN ('name','email','phone','username','address')),
  query_value     TEXT         NOT NULL,
  query_first     TEXT,                     -- when query_type=name, parsed first
  query_last      TEXT,                     -- when query_type=name, parsed last
  query_state     TEXT,
  query_city      TEXT,
  source_filter   TEXT[]       DEFAULT NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  result_count    INT          DEFAULT 0,
  error           TEXT,
  progress        JSONB        DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS sleuth_scan_jobs_user
  ON sleuth_scan_jobs(user_email, created_at DESC);
CREATE INDEX IF NOT EXISTS sleuth_scan_jobs_pending
  ON sleuth_scan_jobs(created_at) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS sleuth_persons (
  person_id     TEXT         NOT NULL,
  source        TEXT         NOT NULL,
  full_name     TEXT,
  first_name    TEXT,
  middle_name   TEXT,
  last_name     TEXT,
  age           INT,
  dob           DATE,
  occupation    TEXT,
  bio           TEXT,
  avatar_url    TEXT,
  city          TEXT,
  state         TEXT,
  zip           TEXT,
  raw           JSONB,
  first_seen    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  last_seen     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (person_id, source)
);
CREATE INDEX IF NOT EXISTS sleuth_persons_name
  ON sleuth_persons(last_name, first_name);

-- Per-record findings — a person can have multiple emails / phones / addresses
-- across sources. Each row is one (person, source, value) triple.
CREATE TABLE IF NOT EXISTS sleuth_emails (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id   TEXT         NOT NULL,
  source      TEXT         NOT NULL,
  email       TEXT         NOT NULL,
  verified    BOOLEAN      DEFAULT FALSE,
  raw         JSONB,
  last_seen   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (person_id, source, email)
);

CREATE TABLE IF NOT EXISTS sleuth_phones (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id   TEXT         NOT NULL,
  source      TEXT         NOT NULL,
  phone       TEXT         NOT NULL,
  carrier     TEXT,
  line_type   TEXT,
  raw         JSONB,
  last_seen   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (person_id, source, phone)
);

CREATE TABLE IF NOT EXISTS sleuth_addresses (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id   TEXT         NOT NULL,
  source      TEXT         NOT NULL,
  address     TEXT,
  city        TEXT,
  state       TEXT,
  zip         TEXT,
  date_seen   DATE,
  raw         JSONB,
  last_seen   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sleuth_usernames (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id   TEXT         NOT NULL,
  source      TEXT         NOT NULL,
  platform    TEXT         NOT NULL,
  handle      TEXT         NOT NULL,
  url         TEXT,
  raw         JSONB,
  last_seen   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (person_id, source, platform, handle)
);
CREATE INDEX IF NOT EXISTS sleuth_usernames_handle ON sleuth_usernames(handle);

CREATE TABLE IF NOT EXISTS sleuth_breaches (
  id            TEXT         PRIMARY KEY,
  person_id     TEXT         NOT NULL,
  source        TEXT         NOT NULL,
  breach_name   TEXT         NOT NULL,
  breach_date   DATE,
  data_classes  TEXT[],
  description   TEXT,
  raw           JSONB,
  last_seen     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sleuth_court_records (
  id            TEXT         PRIMARY KEY,
  person_id     TEXT         NOT NULL,
  source        TEXT         NOT NULL,
  court         TEXT,
  case_number   TEXT,
  case_type     TEXT,
  filed_date    DATE,
  status        TEXT,
  description   TEXT,
  raw           JSONB,
  last_seen     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sleuth_businesses (
  id            TEXT         PRIMARY KEY,
  person_id     TEXT         NOT NULL,
  source        TEXT         NOT NULL,
  company_name  TEXT         NOT NULL,
  role          TEXT,
  state         TEXT,
  status        TEXT,
  formed_date   DATE,
  raw           JSONB,
  last_seen     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sleuth_licenses (
  id            TEXT         PRIMARY KEY,
  person_id     TEXT         NOT NULL,
  source        TEXT         NOT NULL,
  type          TEXT         NOT NULL,
  number        TEXT,
  authority     TEXT,
  status        TEXT,
  issued_date   DATE,
  expires_date  DATE,
  raw           JSONB,
  last_seen     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sleuth_news_mentions (
  id          TEXT         PRIMARY KEY,
  person_id   TEXT         NOT NULL,
  source      TEXT         NOT NULL,
  url         TEXT         NOT NULL,
  title       TEXT,
  publisher   TEXT,
  date        DATE,
  snippet     TEXT,
  raw         JSONB,
  last_seen   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sleuth_scan_results (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id       UUID         NOT NULL REFERENCES sleuth_scan_jobs(id) ON DELETE CASCADE,
  person_id     TEXT         NOT NULL,
  source        TEXT         NOT NULL,
  match_score   INT          NOT NULL DEFAULT 0,
  signals       TEXT[]       DEFAULT '{}',
  ts            TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sleuth_scan_results_scan
  ON sleuth_scan_results(scan_id, match_score DESC);

ALTER TABLE sleuth_scan_jobs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sleuth_persons         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sleuth_emails          ENABLE ROW LEVEL SECURITY;
ALTER TABLE sleuth_phones          ENABLE ROW LEVEL SECURITY;
ALTER TABLE sleuth_addresses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sleuth_usernames       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sleuth_breaches        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sleuth_court_records   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sleuth_businesses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sleuth_licenses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sleuth_news_mentions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sleuth_scan_results    ENABLE ROW LEVEL SECURITY;
