-- HYVE Attend — re-defines attend_complete_checkout (migration 018) to soften
-- its non-PENDING guard. Cart-expiry (Phase 3c) can now set an order CANCELLED;
-- a late checkout.session.completed must NOT raise — that would wedge the
-- Stripe webhook into days of 500 retries. The branch now returns a no-op
-- signal (completed=false) instead. Everything else is identical to 018.
create or replace function attend_complete_checkout(p_args jsonb)
returns jsonb language plpgsql as $$
declare
  v_order_id   uuid := (p_args->>'order_id')::uuid;
  v_payment_id uuid := nullif(p_args->>'payment_id', '')::uuid;
  v_pi         text := nullif(p_args->>'stripe_payment_intent_id', '');
  v_order      attend_orders%rowtype;
  v_artist_net bigint;
begin
  select * into v_order from attend_orders where id = v_order_id for update;
  if v_order.id is null then
    raise exception 'attend_complete_checkout: order % not found', v_order_id;
  end if;

  if v_order.status = 'PAID' then
    return jsonb_build_object('order_id', v_order_id, 'status', 'PAID', 'already_done', true);
  end if;
  -- Neither PENDING nor PAID — e.g. CANCELLED by cart-expiry while a slow
  -- payment was in flight. Do NOT raise: that would wedge the Stripe webhook
  -- into days of 500 retries. Return a no-op signal — the buyer paid a
  -- cancelled order and is owed a refund (Phase 6 refund flow).
  if v_order.status <> 'PENDING' then
    return jsonb_build_object(
      'order_id', v_order_id, 'status', v_order.status, 'completed', false
    );
  end if;

  update attend_orders
     set status = 'PAID',
         stripe_payment_intent_id = coalesce(v_pi, stripe_payment_intent_id),
         updated_at = now()
   where id = v_order_id;

  update attend_tickets
     set state = 'ASSIGNED_TO_BUYER', owner_id = v_order.buyer_id, updated_at = now()
   where order_id = v_order_id and state = 'HELD_IN_CART';

  -- ARTIST_NET_PENDING: under ABSORB the artist absorbs the fees; under
  -- PASS_TO_BUYER the fees were added on top, so the artist nets the subtotal.
  v_artist_net := case
    when v_order.fee_mode = 'PASS_TO_BUYER' then v_order.subtotal_cents
    else v_order.subtotal_cents - v_order.hyve_fee_cents - v_order.processor_fee_cents
  end;

  insert into attend_ledger_entries
    (event_id, order_id, payment_id, type, amount_cents, currency, description, source)
  values
    (v_order.event_id, v_order_id, v_payment_id, 'TICKET_GROSS',
     v_order.subtotal_cents, v_order.currency, 'Ticket sales gross', 'SYSTEM'),
    (v_order.event_id, v_order_id, v_payment_id, 'HYVE_PLATFORM_FEE',
     v_order.hyve_fee_cents, v_order.currency, 'HYVE platform fee', 'SYSTEM'),
    (v_order.event_id, v_order_id, v_payment_id, 'PROCESSOR_FEE_ESTIMATE',
     v_order.processor_fee_cents, v_order.currency, 'Payment processor fee (estimate)', 'SYSTEM'),
    (v_order.event_id, v_order_id, v_payment_id, 'TAX_COLLECTED',
     v_order.tax_cents, v_order.currency, 'Tax collected', 'SYSTEM'),
    (v_order.event_id, v_order_id, v_payment_id, 'ARTIST_NET_PENDING',
     v_artist_net, v_order.currency, 'Artist net, pending payout', 'SYSTEM');

  return jsonb_build_object('order_id', v_order_id, 'status', 'PAID');
end $$;
