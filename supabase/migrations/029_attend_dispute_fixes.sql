-- HYVE Attend — Phase 6c review fixes.
--  * attend_close_dispute — a bad `outcome` argument now returns a structured
--    { ok: false } result instead of raising, so a webhook-driven call can
--    never trigger an infinite Stripe retry (consistent with every other
--    webhook-facing RPC).
--  * idx_attend_disputes_event — the admin dispute queue embeds the event;
--    index attend_disputes.event_id for parity with the other event-scoped
--    tables (migration 012 indexed only the status).

create index if not exists idx_attend_disputes_event on attend_disputes (event_id);

create or replace function attend_close_dispute(p_args jsonb)
returns jsonb language plpgsql as $$
declare
  v_stripe_id text := p_args->>'stripe_dispute_id';
  v_outcome   text := p_args->>'outcome';
  v_dispute   attend_disputes%rowtype;
  v_currency  text;
begin
  select * into v_dispute from attend_disputes
   where stripe_dispute_id = v_stripe_id for update;
  if v_dispute.id is null then
    -- A dispute we never recorded (no matching Attend payment at creation):
    -- a structured result, not an exception, so the webhook does not retry.
    return jsonb_build_object('ok', false, 'error', 'dispute not recorded');
  end if;
  if v_dispute.status in ('WON', 'LOST') then
    return jsonb_build_object('dispute_id', v_dispute.id,
      'status', v_dispute.status, 'already_done', true);
  end if;
  if v_outcome not in ('WON', 'LOST') then
    return jsonb_build_object('ok', false, 'error', 'bad outcome');
  end if;

  select currency into v_currency from attend_orders
   where id = v_dispute.order_id for update;
  v_currency := coalesce(v_currency, 'usd');

  update attend_disputes set status = v_outcome, updated_at = now()
   where id = v_dispute.id;

  -- Release the temporary hold posted at open (the DISPUTE_HOLD pair nets to 0).
  insert into attend_ledger_entries
    (event_id, order_id, payment_id, type, amount_cents, currency, description, source)
  values
    (v_dispute.event_id, v_dispute.order_id, v_dispute.payment_id, 'DISPUTE_HOLD',
     v_dispute.amount_cents, v_currency, 'Card dispute closed — hold released', 'SYSTEM');

  if v_outcome = 'WON' then
    -- We kept the funds: lift the freeze, the order returns to PAID.
    update attend_orders set status = 'PAID', updated_at = now()
     where id = v_dispute.order_id and status = 'DISPUTED';
  else
    -- LOST: the chargeback stands — the money is gone for good.
    insert into attend_ledger_entries
      (event_id, order_id, payment_id, type, amount_cents, currency, description, source)
    values
      (v_dispute.event_id, v_dispute.order_id, v_dispute.payment_id, 'CHARGEBACK_DEBIT',
       -v_dispute.amount_cents, v_currency, 'Dispute lost — chargeback', 'SYSTEM');
  end if;

  return jsonb_build_object('dispute_id', v_dispute.id, 'status', v_outcome);
end $$;
