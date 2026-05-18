-- HYVE Attend — events and ticketing. One row per individual ticket
-- (attend_tickets) so every ticket transfers, checks in, and refunds
-- independently. Orders store a frozen policy_snapshot for refund evidence.

create table if not exists attend_events (
  id                    uuid                 primary key default gen_random_uuid(),
  slug                  text                 not null unique,
  creator_id            uuid                 not null references attend_profiles(id),
  title                 text                 not null,
  description           text,
  show_type             attend_show_type     not null,
  status                attend_event_status  not null default 'DRAFT',
  starts_at             timestamptz,
  ends_at               timestamptz,
  timezone              text                 not null default 'UTC',
  visibility            text                 not null default 'PUBLIC' check (visibility in ('PUBLIC','PRIVATE')),
  hero_media_id         uuid,  -- no FK: attend_event_media is created after this table; integrity enforced in the service layer
  refund_cutoff_hours   int                  not null default 24,
  transfer_cutoff_hours int                  not null default 2,
  policy_text           text,
  replay_available      boolean              not null default false,
  created_at            timestamptz          not null default now(),
  updated_at            timestamptz          not null default now(),
  created_by            text,
  updated_by            text,
  deleted_at            timestamptz
);

create table if not exists attend_event_media (
  id            uuid         primary key default gen_random_uuid(),
  event_id      uuid         not null references attend_events(id) on delete cascade,
  kind          text         not null check (kind in ('HERO_IMAGE','HERO_VIDEO','POSTER','GALLERY')),
  storage_path  text         not null,
  position      int          not null default 0,
  created_at    timestamptz  not null default now()
);

create table if not exists attend_ticket_types (
  id             uuid                     primary key default gen_random_uuid(),
  event_id       uuid                     not null references attend_events(id) on delete cascade,
  name           text                     not null,
  kind           attend_ticket_type_kind  not null default 'GENERAL_ADMISSION',
  price_cents    int                      not null check (price_cents >= 0),
  currency       text                     not null default 'usd',
  quantity_total int                      not null check (quantity_total >= 0),
  quantity_sold  int                      not null default 0 check (quantity_sold >= 0),
  max_per_order  int                      not null default 10 check (max_per_order > 0),
  sales_start_at timestamptz,
  sales_end_at   timestamptz,
  status         text                     not null default 'ACTIVE'
                   check (status in ('ACTIVE','PAUSED','SOLD_OUT','HIDDEN')),
  created_at     timestamptz              not null default now(),
  updated_at     timestamptz              not null default now()
);

create table if not exists attend_orders (
  id                        uuid                 primary key default gen_random_uuid(),
  buyer_id                  uuid                 not null references attend_profiles(id),
  event_id                  uuid                 not null references attend_events(id),
  status                    attend_order_status  not null default 'PENDING',
  subtotal_cents            int                  not null default 0,
  hyve_fee_cents            int                  not null default 0,
  processor_fee_cents       int                  not null default 0,
  tax_cents                 int                  not null default 0,
  total_cents               int                  not null default 0,
  currency                  text                 not null default 'usd',
  fee_mode                  text                 not null default 'ABSORB'
                              check (fee_mode in ('ABSORB','PASS_TO_BUYER')),
  policy_snapshot           jsonb                not null default '{}'::jsonb,
  stripe_checkout_session_id text,
  stripe_payment_intent_id   text,
  created_at                timestamptz          not null default now(),
  updated_at                timestamptz          not null default now()
);

create table if not exists attend_order_line_items (
  id              uuid         primary key default gen_random_uuid(),
  order_id        uuid         not null references attend_orders(id) on delete cascade,
  ticket_type_id  uuid         not null references attend_ticket_types(id),
  quantity        int          not null check (quantity > 0),
  unit_price_cents int         not null check (unit_price_cents >= 0),
  created_at      timestamptz  not null default now()
);

create table if not exists attend_tickets (
  id              uuid                 primary key default gen_random_uuid(),
  order_id        uuid                 not null references attend_orders(id),
  event_id        uuid                 not null references attend_events(id),
  ticket_type_id  uuid                 not null references attend_ticket_types(id),
  owner_id        uuid                 references attend_profiles(id),
  access_token    text                 not null unique,
  state           attend_ticket_state  not null default 'HELD_IN_CART',
  checked_in_at   timestamptz,
  created_at      timestamptz          not null default now(),
  updated_at      timestamptz          not null default now()
);

create table if not exists attend_ticket_transfers (
  id              uuid                    primary key default gen_random_uuid(),
  ticket_id       uuid                    not null references attend_tickets(id) on delete cascade,
  from_profile_id uuid                    not null references attend_profiles(id),
  to_email        text,
  to_profile_id   uuid                    references attend_profiles(id),
  method          attend_transfer_method  not null,
  claim_token     text                    unique,
  friend_code     text                    unique,
  status          attend_transfer_status  not null default 'PENDING',
  accepted_at     timestamptz,
  revoked_at      timestamptz,
  expires_at      timestamptz             not null,
  created_at      timestamptz             not null default now()
);

alter table attend_events            enable row level security;
alter table attend_event_media       enable row level security;
alter table attend_ticket_types      enable row level security;
alter table attend_orders            enable row level security;
alter table attend_order_line_items  enable row level security;
alter table attend_tickets           enable row level security;
alter table attend_ticket_transfers  enable row level security;

create index if not exists idx_attend_events_status      on attend_events (status);
create index if not exists idx_attend_events_creator     on attend_events (creator_id);
create index if not exists idx_attend_ticket_types_event on attend_ticket_types (event_id);
create index if not exists idx_attend_orders_buyer       on attend_orders (buyer_id);
create index if not exists idx_attend_orders_event       on attend_orders (event_id);
create index if not exists idx_attend_tickets_owner      on attend_tickets (owner_id);
create index if not exists idx_attend_tickets_event      on attend_tickets (event_id);
create index if not exists idx_attend_transfers_ticket   on attend_ticket_transfers (ticket_id);
