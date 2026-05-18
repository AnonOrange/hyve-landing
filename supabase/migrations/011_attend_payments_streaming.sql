-- HYVE Attend — payments and streaming. attend_ledger_entries is the
-- append-only money record (spec §16): never updated, never deleted;
-- corrections are new ADJUSTMENT rows. amount_cents is signed.

create table if not exists attend_payments (
  id                        uuid                   primary key default gen_random_uuid(),
  kind                      attend_payment_kind    not null,
  order_id                  uuid                   references attend_orders(id),
  event_id                  uuid                   references attend_events(id),
  profile_id                uuid                   not null references attend_profiles(id),
  amount_cents              int                    not null,
  currency                  text                   not null default 'usd',
  status                    attend_payment_status  not null default 'PENDING',
  stripe_payment_intent_id  text,
  stripe_charge_id          text,
  stripe_refund_id          text,
  created_at                timestamptz            not null default now(),
  updated_at                timestamptz            not null default now()
);

create table if not exists attend_ledger_entries (
  id          uuid                      primary key default gen_random_uuid(),
  event_id    uuid                      references attend_events(id),
  order_id    uuid                      references attend_orders(id),
  payment_id  uuid                      references attend_payments(id),
  ticket_id   uuid                      references attend_tickets(id),
  type        attend_ledger_entry_type  not null,
  amount_cents bigint                   not null,
  currency    text                      not null default 'usd',
  description text                      not null default '',
  source      text                      not null default 'SYSTEM' check (source in ('SYSTEM','HUMAN')),
  created_by  text,
  created_at  timestamptz               not null default now()
);

create table if not exists attend_payouts (
  id                   uuid                  primary key default gen_random_uuid(),
  event_id             uuid                  not null references attend_events(id),
  payout_account_id    uuid                  not null references attend_payout_accounts(id),
  amount_cents         int                   not null,
  currency             text                  not null default 'usd',
  status               attend_payout_status  not null default 'PENDING',
  hold_reason          text,
  scheduled_release_at timestamptz,
  released_at          timestamptz,
  stripe_transfer_id   text,
  created_at           timestamptz           not null default now(),
  updated_at           timestamptz           not null default now()
);

create table if not exists attend_streams (
  id                 uuid                  primary key default gen_random_uuid(),
  event_id           uuid                  not null unique references attend_events(id) on delete cascade,
  provider           text                  not null default 'mux',
  mux_stream_id      text,
  mux_playback_id    text,
  stream_key         text,
  rtmp_url           text,
  status             attend_stream_status  not null default 'IDLE',
  test_passed_at     timestamptz,
  recording_asset_id text,
  started_at         timestamptz,
  ended_at           timestamptz,
  created_at         timestamptz           not null default now(),
  updated_at         timestamptz           not null default now()
);

create table if not exists attend_stream_health_metrics (
  id                  uuid         primary key default gen_random_uuid(),
  stream_id           uuid         not null references attend_streams(id) on delete cascade,
  recorded_at         timestamptz  not null default now(),
  ingest_bitrate      int,
  dropped_frames      int,
  playback_error_count int,
  source              text         not null check (source in ('PROVIDER_WEBHOOK','ATTENDEE_REPORT')),
  metadata            jsonb        not null default '{}'::jsonb,
  created_at          timestamptz  not null default now()
);

alter table attend_payments              enable row level security;
alter table attend_ledger_entries        enable row level security;
alter table attend_payouts                enable row level security;
alter table attend_streams                enable row level security;
alter table attend_stream_health_metrics  enable row level security;

create index if not exists idx_attend_payments_order      on attend_payments (order_id);
create index if not exists idx_attend_ledger_event        on attend_ledger_entries (event_id);
create index if not exists idx_attend_ledger_order        on attend_ledger_entries (order_id);
create index if not exists idx_attend_payouts_event       on attend_payouts (event_id);
create index if not exists idx_attend_stream_health_stream on attend_stream_health_metrics (stream_id);
