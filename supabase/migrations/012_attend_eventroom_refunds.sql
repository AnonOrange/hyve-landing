-- HYVE Attend — event room and refunds/disputes. attend_attendance_sessions
-- is the evidence backbone for refund and dispute decisions (spec §17/§18).

create table if not exists attend_attendance_sessions (
  id                   uuid         primary key default gen_random_uuid(),
  ticket_id            uuid         not null references attend_tickets(id),
  profile_id           uuid         not null references attend_profiles(id),
  event_id             uuid         not null references attend_events(id),
  joined_at            timestamptz  not null default now(),
  left_at              timestamptz,
  watch_seconds        int          not null default 0,
  device               text,
  browser              text,
  ip_hash              text,
  playback_error_count int          not null default 0,
  created_at           timestamptz  not null default now()
);

create table if not exists attend_chat_messages (
  id               uuid         primary key default gen_random_uuid(),
  event_id         uuid         not null references attend_events(id) on delete cascade,
  profile_id       uuid         not null references attend_profiles(id),
  body             text         not null,
  moderation_state text         not null default 'VISIBLE'
                     check (moderation_state in ('VISIBLE','HIDDEN','DELETED')),
  created_at       timestamptz  not null default now()
);

create table if not exists attend_reaction_events (
  id          uuid         primary key default gen_random_uuid(),
  event_id    uuid         not null references attend_events(id) on delete cascade,
  profile_id  uuid         not null references attend_profiles(id),
  kind        text         not null,
  created_at  timestamptz  not null default now()
);

create table if not exists attend_moderation_actions (
  id            uuid         primary key default gen_random_uuid(),
  event_id      uuid         not null references attend_events(id) on delete cascade,
  moderator_id  uuid         not null references attend_profiles(id),
  target_type   text         not null check (target_type in ('MESSAGE','USER')),
  target_id     uuid         not null,
  action        text         not null check (action in ('HIDE','MUTE','BAN','UNMUTE')),
  reason        text,
  created_at    timestamptz  not null default now()
);

create table if not exists attend_refund_requests (
  id                uuid                          primary key default gen_random_uuid(),
  ticket_id         uuid                          not null references attend_tickets(id),
  order_id          uuid                          not null references attend_orders(id),
  event_id          uuid                          not null references attend_events(id),
  requester_id      uuid                          not null references attend_profiles(id),
  reason            text,
  status            attend_refund_status          not null default 'REQUESTED',
  recommendation    attend_refund_recommendation,
  evidence_packet_id uuid,  -- no FK: attend_evidence_packets is created after this table; integrity enforced in the service layer
  resolved_by       uuid                          references attend_profiles(id),
  resolved_at       timestamptz,
  created_at        timestamptz                   not null default now(),
  updated_at        timestamptz                   not null default now()
);

create table if not exists attend_evidence_packets (
  id                uuid         primary key default gen_random_uuid(),
  subject_type      text         not null check (subject_type in ('REFUND','DISPUTE')),
  refund_request_id uuid         references attend_refund_requests(id),
  dispute_id        uuid,  -- no FK: attend_disputes is created after this table; integrity enforced in the service layer
  payload           jsonb        not null default '{}'::jsonb,
  score             numeric,
  generated_at      timestamptz  not null default now(),
  created_at        timestamptz  not null default now()
);

create table if not exists attend_disputes (
  id                 uuid                  primary key default gen_random_uuid(),
  payment_id         uuid                  not null references attend_payments(id),
  order_id           uuid                  not null references attend_orders(id),
  event_id           uuid                  not null references attend_events(id),
  stripe_dispute_id  text                  not null unique,
  reason             text,
  amount_cents       int                   not null,
  status             attend_dispute_status not null default 'NEEDS_RESPONSE',
  evidence_packet_id uuid                  references attend_evidence_packets(id),
  due_by             timestamptz,
  created_at         timestamptz           not null default now(),
  updated_at         timestamptz           not null default now()
);

alter table attend_attendance_sessions enable row level security;
alter table attend_chat_messages       enable row level security;
alter table attend_reaction_events     enable row level security;
alter table attend_moderation_actions  enable row level security;
alter table attend_refund_requests     enable row level security;
alter table attend_evidence_packets    enable row level security;
alter table attend_disputes            enable row level security;

create index if not exists idx_attend_attendance_event   on attend_attendance_sessions (event_id);
create index if not exists idx_attend_attendance_ticket  on attend_attendance_sessions (ticket_id);
create index if not exists idx_attend_chat_event         on attend_chat_messages (event_id);
create index if not exists idx_attend_reactions_event    on attend_reaction_events (event_id);
create index if not exists idx_attend_refunds_status     on attend_refund_requests (status);
create index if not exists idx_attend_disputes_status    on attend_disputes (status);
