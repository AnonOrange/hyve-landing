-- ─────────────────────────────────────────────────────────────────────────────
-- 003_residential_scans.sql
-- Hyve Residential — nationwide distressed-property scan queue + result store.
--
-- Architecture:
--   1. User runs scan from /spy/app/residential → POST /api/residential/scan
--      inserts row in `residential_scan_jobs` with status='pending'.
--   2. Railway worker polls residential_scan_jobs WHERE status='pending'
--      → flips to 'running' → fans out to N adapters in parallel:
--        - federal: HUD, Fannie, Freddie, VA, USDA, IRS, Marshals, GSA
--        - county:  Wake_NC, Mecklenburg_NC, ... (extensible)
--   3. Adapters write found properties + owners + tax + liens + foreclosures
--      to the canonical tables (PRIMARY KEY = parcel_id + source for dedup).
--   4. Worker writes per-property `residential_scan_results` rows linking
--      the scan_job to each found property.
--   5. UI polls GET /api/residential/scan/:id → progress + results.
--
-- Key design choices:
--   - parcel_id + source as composite PK lets multiple sources report the
--     same parcel without conflicting; UI merges by parcel_id at read time.
--   - raw JSONB on each table preserves full scraper output for debugging
--     without losing the forensics when schema evolves.
--   - first_seen / last_seen on properties enables "scan fresh, return
--     stale-with-warning" tier — saves repeat scans for unchanged parcels.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Scan queue ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS residential_scan_jobs (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email      TEXT         NOT NULL,
  status          TEXT         NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','running','completed','failed','cancelled')),
  query_type      TEXT         NOT NULL
                  CHECK (query_type IN ('address','city','county','zip','state')),
  query_value     TEXT         NOT NULL,
  query_state     TEXT,                     -- 2-letter US state (NC, FL, etc)
  source_filter   TEXT[]       DEFAULT NULL,-- NULL = run all adapters; ['HUD','FANNIE'] = subset
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  result_count    INT          DEFAULT 0,
  error           TEXT,
  progress        JSONB        DEFAULT '{}'::jsonb
                  -- shape: { sources_total: 8, sources_done: 3, current: 'HUD',
                  --          per_source: { HUD: { status:'done', count:42 }, ... } }
);

CREATE INDEX IF NOT EXISTS residential_scan_jobs_user
  ON residential_scan_jobs(user_email, created_at DESC);
CREATE INDEX IF NOT EXISTS residential_scan_jobs_pending
  ON residential_scan_jobs(created_at)
  WHERE status = 'pending';

-- ── Properties (dedup'd by parcel_id + source) ──────────────────────────────
CREATE TABLE IF NOT EXISTS residential_properties (
  parcel_id       TEXT         NOT NULL,
  source          TEXT         NOT NULL,    -- HUD, FANNIE, FREDDIE, VA, USDA, IRS, MARSHALS, GSA, ATTOM, WAKE_NC, ...
  county_fips     TEXT,
  county          TEXT,
  address         TEXT         NOT NULL,
  city            TEXT,
  state           TEXT         NOT NULL,    -- 2-letter
  zip             TEXT,
  lat             NUMERIC,
  lng             NUMERIC,
  assessed_value  NUMERIC,
  list_price      NUMERIC,                  -- for REO listings (HUD/Fannie/Freddie)
  land_use        TEXT,
  zoning          TEXT,
  acreage         NUMERIC,
  year_built      INT,
  sq_ft           INT,
  raw             JSONB,                    -- full scraper payload for forensics
  first_seen      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  last_seen       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (parcel_id, source)
);

CREATE INDEX IF NOT EXISTS residential_properties_state
  ON residential_properties(state, last_seen DESC);
CREATE INDEX IF NOT EXISTS residential_properties_city
  ON residential_properties(state, city, last_seen DESC);
CREATE INDEX IF NOT EXISTS residential_properties_zip
  ON residential_properties(zip, last_seen DESC);
CREATE INDEX IF NOT EXISTS residential_properties_parcel
  ON residential_properties(parcel_id);

-- ── Owners ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS residential_owners (
  parcel_id        TEXT NOT NULL,
  source           TEXT NOT NULL,
  name             TEXT NOT NULL,
  owner_type       TEXT NOT NULL DEFAULT 'individual'
                   CHECK (owner_type IN ('individual','llc','trust','estate','other')),
  mailing_address  TEXT,
  mailing_city     TEXT,
  mailing_state    TEXT,
  mailing_zip      TEXT,
  raw              JSONB,
  last_seen        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (parcel_id, source)
);

-- ── Tax records ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS residential_tax_records (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id     TEXT         NOT NULL,
  source        TEXT         NOT NULL,
  tax_year      INT          NOT NULL,
  amount_due    NUMERIC      NOT NULL DEFAULT 0,
  amount_paid   NUMERIC      NOT NULL DEFAULT 0,
  penalty       NUMERIC      DEFAULT 0,
  interest      NUMERIC      DEFAULT 0,
  raw           JSONB,
  last_seen     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (parcel_id, source, tax_year)
);

CREATE INDEX IF NOT EXISTS residential_tax_parcel
  ON residential_tax_records(parcel_id);

-- ── Liens ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS residential_liens (
  id            TEXT         PRIMARY KEY,    -- source-supplied lien ID, prefix with source
  parcel_id     TEXT         NOT NULL,
  source        TEXT         NOT NULL,
  type          TEXT         NOT NULL
                CHECK (type IN ('hoa','mechanic','contractor','judgment','other')),
  plaintiff     TEXT,
  amount        NUMERIC      NOT NULL DEFAULT 0,
  filing_date   DATE,
  status        TEXT         NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','satisfied','released')),
  raw           JSONB,
  last_seen     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS residential_liens_parcel
  ON residential_liens(parcel_id);

-- ── Foreclosures ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS residential_foreclosures (
  id            TEXT         PRIMARY KEY,    -- source-supplied case ID, prefix with source
  parcel_id     TEXT         NOT NULL,
  source        TEXT         NOT NULL,
  stage         TEXT         NOT NULL
                CHECK (stage IN ('filed','notice_of_hearing','hearing_scheduled','sale_scheduled','sold','dismissed')),
  filed_date    DATE,
  hearing_date  DATE,
  sale_date     DATE,
  trustee       TEXT,
  case_number   TEXT,
  raw           JSONB,
  last_seen     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS residential_foreclosures_parcel
  ON residential_foreclosures(parcel_id);

-- ── Scan results — links a found parcel back to the scan that surfaced it ──
CREATE TABLE IF NOT EXISTS residential_scan_results (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id         UUID         NOT NULL REFERENCES residential_scan_jobs(id) ON DELETE CASCADE,
  parcel_id       TEXT         NOT NULL,
  source          TEXT         NOT NULL,
  distress_score  INT          NOT NULL DEFAULT 0,
  signals         TEXT[]       DEFAULT '{}',
  ts              TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS residential_scan_results_scan
  ON residential_scan_results(scan_id, distress_score DESC);

-- ── RLS — service role bypasses; lock down anon access ──────────────────────
ALTER TABLE residential_scan_jobs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE residential_properties      ENABLE ROW LEVEL SECURITY;
ALTER TABLE residential_owners          ENABLE ROW LEVEL SECURITY;
ALTER TABLE residential_tax_records     ENABLE ROW LEVEL SECURITY;
ALTER TABLE residential_liens           ENABLE ROW LEVEL SECURITY;
ALTER TABLE residential_foreclosures    ENABLE ROW LEVEL SECURITY;
ALTER TABLE residential_scan_results    ENABLE ROW LEVEL SECURITY;
