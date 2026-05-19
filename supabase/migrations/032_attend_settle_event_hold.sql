-- HYVE Attend — make the settlement hold window risk-aware (spec §16/§26).
-- attend_settle_event (migration 030) hardcoded a 7-day hold; it now takes a
-- hold_days argument so the caller can extend the hold for a high-risk event.
-- All other behaviour is unchanged from migration 030.
create or replace function attend_settle_event(p_args jsonb)
returns jsonb language plpgsql as $$
declare
  v_event_id   uuid := (p_args->>'event_id')::uuid;
  v_amount     int  := (p_args->>'amount_cents')::int;
  v_hold_days  int  := greatest(1, coalesce((p_args->>'hold_days')::int, 7));
  v_event      attend_events%rowtype;
  v_account_id uuid;
  v_payout_id  uuid;
begin
  select * into v_event from attend_events where id = v_event_id for update;
  if v_event.id is null then
    raise exception 'attend_settle_event: event % not found', v_event_id;
  end if;
  if v_event.status <> 'ENDED' then
    return jsonb_build_object('event_id', v_event_id, 'settled', false,
      'reason', 'not awaiting settlement');
  end if;

  select pa.id into v_account_id
    from attend_payout_accounts pa
   where pa.profile_id = v_event.creator_id;

  if v_amount <= 0 or v_account_id is null then
    update attend_events set status = 'SETTLED', updated_at = now()
     where id = v_event_id;
    return jsonb_build_object('event_id', v_event_id, 'settled', true, 'payout', false);
  end if;

  insert into attend_payouts
    (event_id, payout_account_id, amount_cents, status, scheduled_release_at)
  values
    (v_event_id, v_account_id, v_amount, 'HELD', now() + make_interval(days => v_hold_days))
  returning id into v_payout_id;

  update attend_events set status = 'SETTLEMENT_HOLD', updated_at = now()
   where id = v_event_id;

  return jsonb_build_object('event_id', v_event_id, 'settled', true,
    'payout', true, 'payout_id', v_payout_id);
end $$;
