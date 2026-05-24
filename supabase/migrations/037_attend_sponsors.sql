-- HYVE Attend — site sponsors. Admin-managed (reviewer-gated) sponsor credits
-- shown in the Attend footer. Distinct from event promotion/featured campaigns
-- (that's the paid per-event ad system). is_active is the on/off switch.
-- RLS enabled, no policies — service-key access, and the active filter is
-- applied in the query layer (matches Attend's posture; HyveNews used anon-read
-- policies instead, but Attend reads via the service key).

create table if not exists attend_sponsors (
  id          uuid         primary key default gen_random_uuid(),
  name        text         not null,
  url         text         not null,
  logo_url    text,
  tier        text         not null default 'COMMUNITY'
                 check (tier in ('PLATINUM','GOLD','SILVER','COMMUNITY')),
  blurb       text,
  is_active   boolean      not null default true,
  sort_order  int          not null default 0,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now(),
  created_by  text,
  updated_by  text,
  deleted_at  timestamptz
);

alter table attend_sponsors enable row level security;

create index if not exists idx_attend_sponsors_active
  on attend_sponsors (sort_order) where is_active = true and deleted_at is null;
