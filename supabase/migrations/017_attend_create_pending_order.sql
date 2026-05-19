-- HYVE Attend — attend_create_pending_order RPC body (replaces the Phase 1
-- stub). Atomically holds inventory and creates a PENDING order with one
-- HELD_IN_CART ticket per seat. A Stripe Checkout session is opened next;
-- the cart-expiry job (Phase 3c) reclaims the hold if it is never paid.
create or replace function attend_create_pending_order(p_args jsonb)
returns jsonb language plpgsql as $$
declare
  v_buyer_id uuid := (p_args->>'buyer_id')::uuid;
  v_event_id uuid := (p_args->>'event_id')::uuid;
  v_currency text := coalesce(p_args->>'currency', 'usd');
  v_fee_mode text := coalesce(p_args->>'fee_mode', 'ABSORB');
  v_event    attend_events%rowtype;
  v_order_id uuid;
  v_item     jsonb;
  v_tt       attend_ticket_types%rowtype;
  v_qty      int;
  i          int;
begin
  select * into v_event from attend_events where id = v_event_id for update;
  if v_event.id is null then
    raise exception 'attend_create_pending_order: event % not found', v_event_id;
  end if;
  if v_event.status <> 'ON_SALE' then
    raise exception 'attend_create_pending_order: event % is not on sale (%)',
      v_event_id, v_event.status;
  end if;

  insert into attend_orders (
    buyer_id, event_id, status, subtotal_cents, hyve_fee_cents, processor_fee_cents,
    tax_cents, total_cents, currency, fee_mode, policy_snapshot
  ) values (
    v_buyer_id, v_event_id, 'PENDING',
    (p_args->>'subtotal_cents')::int, (p_args->>'hyve_fee_cents')::int,
    (p_args->>'processor_fee_cents')::int, (p_args->>'tax_cents')::int,
    (p_args->>'total_cents')::int, v_currency, v_fee_mode,
    jsonb_build_object(
      'policy_text', v_event.policy_text,
      'refund_cutoff_hours', v_event.refund_cutoff_hours,
      'transfer_cutoff_hours', v_event.transfer_cutoff_hours
    )
  ) returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_args->'items') loop
    v_qty := (v_item->>'quantity')::int;
    if v_qty < 1 then
      raise exception 'attend_create_pending_order: quantity must be >= 1';
    end if;

    select * into v_tt from attend_ticket_types
      where id = (v_item->>'ticket_type_id')::uuid for update;
    if v_tt.id is null or v_tt.event_id <> v_event_id then
      raise exception 'attend_create_pending_order: ticket type % not on event %',
        v_item->>'ticket_type_id', v_event_id;
    end if;
    if v_tt.status <> 'ACTIVE' then
      raise exception 'attend_create_pending_order: ticket type % is not on sale', v_tt.id;
    end if;
    if v_qty > v_tt.max_per_order then
      raise exception 'attend_create_pending_order: quantity % exceeds max % per order',
        v_qty, v_tt.max_per_order;
    end if;
    if v_tt.quantity_sold + v_qty > v_tt.quantity_total then
      raise exception 'attend_create_pending_order: not enough tickets left for "%"', v_tt.name;
    end if;

    update attend_ticket_types
       set quantity_sold = quantity_sold + v_qty, updated_at = now()
     where id = v_tt.id;

    insert into attend_order_line_items (order_id, ticket_type_id, quantity, unit_price_cents)
    values (v_order_id, v_tt.id, v_qty, v_tt.price_cents);

    for i in 1..v_qty loop
      insert into attend_tickets
        (order_id, event_id, ticket_type_id, owner_id, access_token, state)
      values
        (v_order_id, v_event_id, v_tt.id, null, gen_random_uuid()::text, 'HELD_IN_CART');
    end loop;
  end loop;

  return jsonb_build_object('order_id', v_order_id, 'status', 'PENDING');
end $$;
