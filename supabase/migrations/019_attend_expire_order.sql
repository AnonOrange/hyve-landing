-- HYVE Attend — attend_expire_order RPC. Atomically reclaims an abandoned
-- PENDING order: order -> CANCELLED, its HELD_IN_CART tickets -> EXPIRED, and
-- the held quantity_sold restored. Idempotent: a non-PENDING order is a no-op,
-- so the cart-expiry job is safe to run repeatedly and races a payment safely.
create or replace function attend_expire_order(p_args jsonb)
returns jsonb language plpgsql as $$
declare
  v_order_id uuid := (p_args->>'order_id')::uuid;
  v_order    attend_orders%rowtype;
  v_li       record;
begin
  select * into v_order from attend_orders where id = v_order_id for update;
  if v_order.id is null then
    raise exception 'attend_expire_order: order % not found', v_order_id;
  end if;

  if v_order.status <> 'PENDING' then
    return jsonb_build_object('order_id', v_order_id, 'status', v_order.status, 'expired', false);
  end if;

  update attend_orders set status = 'CANCELLED', updated_at = now() where id = v_order_id;

  update attend_tickets
     set state = 'EXPIRED', updated_at = now()
   where order_id = v_order_id and state = 'HELD_IN_CART';

  for v_li in
    select ticket_type_id, quantity from attend_order_line_items where order_id = v_order_id
  loop
    update attend_ticket_types
       set quantity_sold = greatest(0, quantity_sold - v_li.quantity), updated_at = now()
     where id = v_li.ticket_type_id;
  end loop;

  return jsonb_build_object('order_id', v_order_id, 'status', 'CANCELLED', 'expired', true);
end $$;
