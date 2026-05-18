-- HYVE Attend — identity: profiles, artist profiles, payout accounts.
-- attend_profiles.id == auth.users.id (1:1). RLS is enabled to match the
-- repo; access is via the service key and authorized in the service layer.

create table if not exists attend_profiles (
  id            uuid         primary key references auth.users(id) on delete cascade,
  display_name  text         not null,
  email         text         not null,
  role          attend_role  not null default 'USER',
  avatar_url    text,
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now()
);

create table if not exists attend_artist_profiles (
  id          uuid         primary key default gen_random_uuid(),
  profile_id  uuid         not null unique references attend_profiles(id) on delete cascade,
  stage_name  text         not null,
  bio         text,
  avatar_url  text,
  links       jsonb        not null default '{}'::jsonb,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now()
);

create table if not exists attend_payout_accounts (
  id                         uuid         primary key default gen_random_uuid(),
  profile_id                 uuid         not null references attend_profiles(id) on delete cascade,
  stripe_connect_account_id  text         not null unique,
  status                     text         not null default 'ONBOARDING'
                               check (status in ('ONBOARDING','VERIFIED','RESTRICTED','DISABLED')),
  charges_enabled            boolean      not null default false,
  payouts_enabled            boolean      not null default false,
  created_at                 timestamptz  not null default now(),
  updated_at                 timestamptz  not null default now()
);

alter table attend_profiles        enable row level security;
alter table attend_artist_profiles enable row level security;
alter table attend_payout_accounts enable row level security;

create index if not exists idx_attend_artist_profiles_profile on attend_artist_profiles (profile_id);
create index if not exists idx_attend_payout_accounts_profile on attend_payout_accounts (profile_id);
