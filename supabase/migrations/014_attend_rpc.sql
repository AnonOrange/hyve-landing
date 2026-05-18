-- HYVE Attend — atomic RPC function stubs (spec §5.3). Each money-critical
-- multi-table write is one function so its body runs in a single implicit
-- transaction. Bodies are filled in Phases 2-6; these stubs only fix the
-- signatures. Each takes one jsonb payload computed by the TypeScript caller.

create or replace function attend_create_pending_order(p_args jsonb)
returns jsonb language plpgsql as $$
begin
  raise exception 'attend_create_pending_order not implemented (Phase 3)';
end $$;

create or replace function attend_complete_checkout(p_args jsonb)
returns jsonb language plpgsql as $$
begin
  raise exception 'attend_complete_checkout not implemented (Phase 3)';
end $$;

create or replace function attend_pay_registration(p_args jsonb)
returns jsonb language plpgsql as $$
begin
  raise exception 'attend_pay_registration not implemented (Phase 2)';
end $$;

create or replace function attend_claim_transfer(p_args jsonb)
returns jsonb language plpgsql as $$
begin
  raise exception 'attend_claim_transfer not implemented (Phase 4)';
end $$;

create or replace function attend_process_refund(p_args jsonb)
returns jsonb language plpgsql as $$
begin
  raise exception 'attend_process_refund not implemented (Phase 6)';
end $$;

create or replace function attend_release_payout(p_args jsonb)
returns jsonb language plpgsql as $$
begin
  raise exception 'attend_release_payout not implemented (Phase 6)';
end $$;

create or replace function attend_cancel_event_refunds(p_args jsonb)
returns jsonb language plpgsql as $$
begin
  raise exception 'attend_cancel_event_refunds not implemented (Phase 6)';
end $$;
