-- HYVE Attend — promotion, risk, and cross-cutting tables.
-- attend_webhook_events deduplicates Stripe/Mux deliveries (spec §10).

create table if not exists attend_promotion_campaigns (
  id           uuid         primary key default gen_random_uuid(),
  event_id     uuid         not null unique references attend_events(id) on delete cascade,
  budget_cents int          not null default 5000,
  status       text         not null default 'ACTIVE'
                 check (status in ('ACTIVE','PAUSED','EXHAUSTED','CLOSED')),
  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now()
);

create table if not exists attend_promotion_spend (
  id           uuid         primary key default gen_random_uuid(),
  campaign_id  uuid         not null references attend_promotion_campaigns(id) on delete cascade,
  kind         text         not null check (kind in ('INTERNAL_PLACEMENT','EXTERNAL')),
  amount_cents int          not null default 0,
  impressions  int          not null default 0,
  clicks       int          not null default 0,
  conversions  int          not null default 0,
  recorded_at  timestamptz  not null default now(),
  created_at   timestamptz  not null default now()
);

create table if not exists attend_risk_scores (
  id           uuid         primary key default gen_random_uuid(),
  subject_type text         not null check (subject_type in ('EVENT','USER')),
  subject_id   uuid         not null,
  score        numeric      not null,
  factors      jsonb        not null default '{}'::jsonb,
  computed_at  timestamptz  not null default now(),
  created_at   timestamptz  not null default now()
);

create table if not exists attend_webhook_events (
  id                uuid         primary key default gen_random_uuid(),
  provider          text         not null check (provider in ('STRIPE','MUX')),
  provider_event_id text         not null unique,
  event_type        text         not null,
  payload           jsonb        not null default '{}'::jsonb,
  processed_at      timestamptz,
  created_at        timestamptz  not null default now()
);

create table if not exists attend_audit_logs (
  id          uuid         primary key default gen_random_uuid(),
  actor_id    uuid,
  actor_type  text         not null default 'SYSTEM' check (actor_type in ('HUMAN','SYSTEM')),
  action      text         not null,
  entity_type text         not null,
  entity_id   uuid,
  metadata    jsonb        not null default '{}'::jsonb,
  ip_hash     text,
  user_agent  text,
  created_at  timestamptz  not null default now()
);

create table if not exists attend_notifications (
  id          uuid         primary key default gen_random_uuid(),
  profile_id  uuid         not null references attend_profiles(id) on delete cascade,
  kind        text         not null,
  payload     jsonb        not null default '{}'::jsonb,
  channels    text[]       not null default '{}',
  read_at     timestamptz,
  created_at  timestamptz  not null default now()
);

alter table attend_promotion_campaigns enable row level security;
alter table attend_promotion_spend     enable row level security;
alter table attend_risk_scores         enable row level security;
alter table attend_webhook_events      enable row level security;
alter table attend_audit_logs          enable row level security;
alter table attend_notifications       enable row level security;

create index if not exists idx_attend_promo_spend_campaign on attend_promotion_spend (campaign_id);
create index if not exists idx_attend_risk_subject         on attend_risk_scores (subject_type, subject_id);
create index if not exists idx_attend_notifications_profile on attend_notifications (profile_id);
