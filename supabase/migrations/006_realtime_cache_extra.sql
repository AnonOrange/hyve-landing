-- Round 2 of the realtime cache layer — covers the 3 huge payloads not in
-- migration 005:
--   /cameras/world          10 MB  → live_world_cameras
--   /cameras/offenders      55 MB  → live_offenders   (sex offender registry)
--   /cameras/surveillance   67 MB  → live_surveillance_cameras (Flock/ALPR/etc)
--
-- These change less frequently than the hot data (cameras/feeds/crime), so the
-- worker syncs them on a longer cadence (every 5 min vs every 1 min).

CREATE TABLE IF NOT EXISTS live_world_cameras (
  id            TEXT         PRIMARY KEY,
  label         TEXT,
  source        TEXT,
  feed_url      TEXT,
  feed_type     TEXT,
  agency        TEXT,
  category      TEXT,
  state         TEXT,
  county        TEXT,
  lat           NUMERIC      NOT NULL,
  lng           NUMERIC      NOT NULL,
  is_verified   BOOLEAN      DEFAULT FALSE,
  is_ptz        BOOLEAN      DEFAULT FALSE,
  thumbnail_url TEXT,
  raw           JSONB,
  last_updated  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS live_world_cameras_geo
  ON live_world_cameras(lat, lng);

CREATE TABLE IF NOT EXISTS live_offenders (
  id            TEXT         PRIMARY KEY,
  label         TEXT,
  source        TEXT,
  feed_url      TEXT,
  agency        TEXT,
  state         TEXT,
  county        TEXT,
  lat           NUMERIC      NOT NULL,
  lng           NUMERIC      NOT NULL,
  details       JSONB,
  raw           JSONB,
  last_updated  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS live_offenders_geo
  ON live_offenders(lat, lng);
CREATE INDEX IF NOT EXISTS live_offenders_state
  ON live_offenders(state);

CREATE TABLE IF NOT EXISTS live_surveillance_cameras (
  id                TEXT         PRIMARY KEY,
  label             TEXT,
  source            TEXT,
  feed_url          TEXT,
  feed_type         TEXT,
  agency            TEXT,
  state             TEXT,
  county            TEXT,
  lat               NUMERIC      NOT NULL,
  lng               NUMERIC      NOT NULL,
  surveillance_type TEXT,
  is_verified       BOOLEAN      DEFAULT FALSE,
  raw               JSONB,
  last_updated      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS live_surveillance_geo
  ON live_surveillance_cameras(lat, lng);
CREATE INDEX IF NOT EXISTS live_surveillance_type
  ON live_surveillance_cameras(surveillance_type);

ALTER TABLE live_world_cameras         ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_offenders             ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_surveillance_cameras  ENABLE ROW LEVEL SECURITY;
