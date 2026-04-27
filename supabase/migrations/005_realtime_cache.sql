-- Realtime cache layer between hyve-api.vercel.app and the spy app.
--
-- A Vercel cron polls hyve-api every minute and upserts into these tables.
-- Client API routes read from these tables with geo-bbox + limit filters
-- so each user gets a small (50-200KB) location-scoped slice instead of
-- the 18MB full-CONUS payload.

CREATE TABLE IF NOT EXISTS live_cameras (
  id            TEXT         PRIMARY KEY,
  label         TEXT,
  source        TEXT,
  feed_url      TEXT,
  feed_type     TEXT,
  agency        TEXT,
  city          TEXT,
  state         TEXT,
  lat           NUMERIC      NOT NULL,
  lng           NUMERIC      NOT NULL,
  is_ptz        BOOLEAN      DEFAULT FALSE,
  raw           JSONB,
  last_updated  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS live_cameras_geo
  ON live_cameras(lat, lng);

CREATE TABLE IF NOT EXISTS live_feeds (
  id            TEXT         PRIMARY KEY,
  name          TEXT,
  agency        TEXT,
  type          TEXT,
  feed_type     TEXT,
  county        TEXT,
  state         TEXT,
  lat           NUMERIC,
  lng           NUMERIC,
  stream_url    TEXT,
  listeners     INT          DEFAULT 0,
  raw           JSONB,
  last_updated  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS live_feeds_geo
  ON live_feeds(lat, lng) WHERE lat IS NOT NULL;
CREATE INDEX IF NOT EXISTS live_feeds_listeners
  ON live_feeds(listeners DESC);

CREATE TABLE IF NOT EXISTS live_crime_incidents (
  id            TEXT         PRIMARY KEY,
  city          TEXT,
  state         TEXT,
  category      TEXT,
  subcategory   TEXT,
  description   TEXT,
  lat           NUMERIC      NOT NULL,
  lng           NUMERIC      NOT NULL,
  occurred_at   TIMESTAMPTZ,
  raw           JSONB,
  last_updated  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS live_crime_geo
  ON live_crime_incidents(lat, lng);
CREATE INDEX IF NOT EXISTS live_crime_occurred
  ON live_crime_incidents(occurred_at DESC);

-- Sync metadata — when each source was last refreshed
CREATE TABLE IF NOT EXISTS live_sync_meta (
  source        TEXT         PRIMARY KEY,    -- 'cameras' | 'feeds' | 'crime'
  last_synced   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  row_count     INT          DEFAULT 0,
  status        TEXT         DEFAULT 'ok',
  error         TEXT
);

ALTER TABLE live_cameras           ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_feeds             ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_crime_incidents   ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_sync_meta         ENABLE ROW LEVEL SECURITY;
