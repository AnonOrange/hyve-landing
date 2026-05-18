-- HYVE Attend — enum types. All Attend types are prefixed attend_ to stay
-- isolated in the shared database. Idempotent: re-running is safe.

do $$ begin
  create type attend_role as enum ('USER','CREATOR','MODERATOR','ADMIN','REVIEWER');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attend_show_type as enum
    ('HUMAN_LIVE_BROADCAST','AI_SCHEDULED_PERFORMANCE','HYBRID_HUMAN_AI','PRIVATE_EVENT','FREE_EVENT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attend_event_status as enum
    ('DRAFT','REGISTRATION_PENDING','PROMOTION_FEE_PAID','PAYOUT_SETUP_REQUIRED',
     'STREAM_SETUP_REQUIRED','SUBMITTED_FOR_REVIEW','PUBLISHED','ON_SALE','SALES_PAUSED',
     'SOUNDCHECK','DOORS_OPEN','LIVE','ENDED','SETTLEMENT_HOLD','SETTLED','REFUNDING',
     'CANCELLED','ARCHIVED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attend_ticket_type_kind as enum
    ('GENERAL_ADMISSION','VIP','BACKSTAGE_QA','REPLAY_ACCESS','GROUP_PACK','EARLY_BIRD',
     'PROMO_CODE','COMPLIMENTARY');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attend_ticket_state as enum
    ('HELD_IN_CART','PURCHASED','ASSIGNED_TO_BUYER','TRANSFER_PENDING_EMAIL',
     'TRANSFER_PENDING_FRIEND_CODE','TRANSFER_ACCEPTED','TRANSFER_REVOKED','CHECKED_IN',
     'IN_ROOM','USED','NO_SHOW','REFUND_REQUESTED','REFUNDED','DISPUTED','CANCELLED','EXPIRED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attend_order_status as enum
    ('PENDING','PAID','PARTIALLY_REFUNDED','REFUNDED','CANCELLED','DISPUTED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attend_payment_kind as enum ('TICKET_PURCHASE','REGISTRATION_FEE','REFUND');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attend_payment_status as enum ('PENDING','SUCCEEDED','FAILED','REFUNDED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attend_ledger_entry_type as enum
    ('TICKET_GROSS','HYVE_PLATFORM_FEE','PROCESSOR_FEE_ESTIMATE','TAX_COLLECTED',
     'ARTIST_NET_PENDING','PROMOTION_REGISTRATION_FEE','PROMOTION_BUDGET_ALLOCATED',
     'PROMOTION_SPEND','REFUND_DEBIT','DISPUTE_HOLD','CHARGEBACK_DEBIT','PAYOUT_RELEASED',
     'PAYOUT_FAILED','ADJUSTMENT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attend_payout_status as enum ('PENDING','HELD','RELEASED','FAILED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attend_transfer_method as enum ('EMAIL','FRIEND_CODE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attend_transfer_status as enum ('PENDING','ACCEPTED','REVOKED','EXPIRED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attend_stream_status as enum ('IDLE','TESTING','ACTIVE','DISCONNECTED','ENDED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attend_refund_status as enum
    ('REQUESTED','EVIDENCE_BUILDING','AUTO_RECOMMENDED','NEEDS_HUMAN_REVIEW','APPROVED',
     'DENIED','PROCESSED','CANCELLED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attend_refund_recommendation as enum ('APPROVE','DENY','NEEDS_HUMAN');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attend_dispute_status as enum
    ('NEEDS_RESPONSE','EVIDENCE_BUILDING','EVIDENCE_READY','SUBMITTED','WON','LOST',
     'ACCEPTED','EXPIRED','ESCALATED');
exception when duplicate_object then null; end $$;
