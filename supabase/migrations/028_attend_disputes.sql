-- HYVE Attend — the two card-dispute RPCs (spec §18). Both are driven by the
-- Stripe webhook, so both are idempotent against a retried delivery.
--
-- attend_open_dispute records a new dispute, freezes the order (-> DISPUTED),
-- and posts a temporary DISPUTE_HOLD ledger entry (the disputed amount leaves
-- the artist's pending net while the dispute is open). Idempotent on the
-- unique stripe_dispute_id.
create or replace function attend_open_dispute(p_args jsonb)
returns jsonb language plpgsql as $$
declare
  v_stripe_id  text := p_args->>'stripe_dispute_id';
  v_payment_id uuid := (p_args->>'payment_id')::uuid;
  v_order_id   uuid := (p_args->>'order_id')::uuid;
  v_event_id   uuid := (p_args->>'event_id')::uuid;
  v_amount     int  := (p_args->>'amount_cents')::int;
  v_reason     text := nullif(p_args->>'reason', '');
  v_due_by     timestamptz := nullif(p_args->>'due_by', '')::timestamptz;
  v_existing   uuid;
  v_dispute_id uuid;
  v_order      attend_orders%rowtype;
begin
  -- Idempotent: a retried webhook for the same Stripe dispute is a no-op.
  select id into v_existing from attend_disputes where stripe_dispute_id = v_stripe_id;
  if v_existing is not null then
    return jsonb_build_object('dispute_id', v_existing, 'already_done', true);
  end if;

  select * into v_order from attend_orders where id = v_order_id for update;

  insert into attend_disputes
    (payment_id, order_id, event_id, stripe_dispute_id, reason, amount_cents,
     status, due_by)
  values
    (v_payment_id, v_order_id, v_event_id, v_stripe_id, v_reason, v_amount,
     'NEEDS_RESPONSE', v_due_by)
  returning id into v_dispute_id;

  -- Freeze the order (§18). The refund RPC already refuses a disputed order.
  if v_order.id is not null then
    update attend_orders set status = 'DISPUTED', updated_at = now()
     where id = v_order_id;
  end if;

  -- Temporary ledger hold: the disputed amount leaves the artist's pending net
  -- until the dispute closes (attend_close_dispute releases it either way).
  insert into attend_ledger_entries
    (event_id, order_id, payment_id, type, amount_cents, currency, description, source)
  values
    (v_event_id, v_order_id, v_payment_id, 'DISPUTE_HOLD', -v_amount,
     coalesce(v_order.currency, 'usd'), 'Funds held — card dispute opened', 'SYSTEM');

  return jsonb_build_object('dispute_id', v_dispute_id);
end $$;

-- attend_close_dispute resolves a dispute. It ALWAYS releases the temporary
-- DISPUTE_HOLD (so the two DISPUTE_HOLD entries net to zero); a WON dispute
-- returns the order to PAID, a LOST dispute additionally posts the real,
-- permanent CHARGEBACK_DEBIT. Idempotent once the dispute is WON/LOST.
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
    raise exception 'attend_close_dispute: bad outcome %', v_outcome;
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
