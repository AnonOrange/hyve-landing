-- HYVE Attend — attend_pay_registration RPC body (replaces the Phase 1 stub).
-- Atomically: move the event REGISTRATION_PENDING -> PROMOTION_FEE_PAID,
-- create its $50 promotion campaign, and post the registration ledger
-- entries. Idempotent — a retried webhook is a safe no-op.

create or replace function attend_pay_registration(p_args jsonb)
returns jsonb language plpgsql as $$
declare
  v_event_id   uuid := (p_args->>'event_id')::uuid;
  v_payment_id uuid := nullif(p_args->>'payment_id', '')::uuid;
  v_actor      text := coalesce(p_args->>'actor', 'system');
  v_status     attend_event_status;
begin
  select status into v_status from attend_events where id = v_event_id for update;
  if v_status is null then
    raise exception 'attend_pay_registration: event % not found', v_event_id;
  end if;

  -- Already processed (e.g. a retried webhook) — no-op.
  if v_status <> 'REGISTRATION_PENDING' then
    return jsonb_build_object('event_id', v_event_id, 'status', v_status, 'already_done', true);
  end if;

  update attend_events
     set status = 'PROMOTION_FEE_PAID', updated_at = now(), updated_by = v_actor
   where id = v_event_id;

  insert into attend_promotion_campaigns (event_id, budget_cents, status)
  values (v_event_id, 5000, 'ACTIVE')
  on conflict (event_id) do nothing;

  insert into attend_ledger_entries
    (event_id, payment_id, type, amount_cents, currency, description, source, created_by)
  values
    (v_event_id, v_payment_id, 'PROMOTION_REGISTRATION_FEE', 5000, 'usd',
     'Show registration fee', 'SYSTEM', v_actor),
    (v_event_id, v_payment_id, 'PROMOTION_BUDGET_ALLOCATED', 5000, 'usd',
     'Promotion budget allocated from the registration fee', 'SYSTEM', v_actor);

  return jsonb_build_object('event_id', v_event_id, 'status', 'PROMOTION_FEE_PAID');
end $$;
