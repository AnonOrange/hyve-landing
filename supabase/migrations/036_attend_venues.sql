-- HYVE Attend — venues + venue scan assets (see spec 2026-05-24). A venue is
-- a first-class place that can host events; venues provide their own scans, or
-- HYVE is contracted. Each asset carries its validated venue.json manifest +
-- storage refs + a validation lifecycle. RLS enabled, no policies (service-key
-- access, authorized in the service layer) to match the rest of attend.

create type attend_venue_asset_status as enum (
  'PENDING_VALIDATION', 'VALIDATED', 'REJECTED', 'ACTIVE', 'ARCHIVED'
);

create table if not exists attend_venues (
  id          uuid         primary key default gen_random_uuid(),
  slug        text         not null unique,
  name        text         not null,
  city        text,
  country     text,
  managed_by  uuid         references attend_profiles(id),
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now(),
  created_by  text,
  updated_by  text,
  deleted_at  timestamptz
);

create table if not exists attend_venue_assets (
  id                  uuid                       primary key default gen_random_uuid(),
  venue_id            uuid                       not null references attend_venues(id) on delete cascade,
  tier                text                       not null check (tier in ('PANO_360','NAV_MESH')),
  status              attend_venue_asset_status  not null default 'PENDING_VALIDATION',
  manifest            jsonb                      not null,
  storage_path        text                       not null,
  validation_errors   jsonb,
  validation_warnings jsonb,
  created_at          timestamptz                not null default now(),
  updated_at          timestamptz                not null default now(),
  created_by          text,
  updated_by          text,
  deleted_at          timestamptz
);

alter table attend_venues       enable row level security;
alter table attend_venue_assets enable row level security;

create index if not exists idx_attend_venues_slug on attend_venues (slug);
create index if not exists idx_attend_venues_managed_by on attend_venues (managed_by) where deleted_at is null;
create index if not exists idx_attend_venue_assets_venue on attend_venue_assets (venue_id) where deleted_at is null;
create index if not exists idx_attend_venue_assets_status on attend_venue_assets (status) where deleted_at is null;

-- Public-read bucket: venue scans are shown to attendees and the browser
-- viewer fetches them directly. Writes go through the service key only.
insert into storage.buckets (id, name, public)
values ('attend-venue-assets', 'attend-venue-assets', true)
on conflict (id) do nothing;
