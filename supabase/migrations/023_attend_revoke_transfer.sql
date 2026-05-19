-- HYVE Attend — attend_revoke_transfer RPC. The sender cancels a pending
-- transfer; the ticket returns to its owned-idle state (ASSIGNED_TO_BUYER if
-- the owner is the order's buyer, else TRANSFER_ACCEPTED). Returns { ok, error? }.
create or replace function attend_revoke_transfer(p_args jsonb)
returns jsonb language plpgsql as $$
declare
  v_transfer_id uuid := (p_args->>'transfer_id')::uuid;
  v_actor       uuid := (p_args->>'actor_id')::uuid;
  v_transfer    attend_ticket_transfers%rowtype;
  v_ticket      attend_tickets%rowtype;
  v_buyer       uuid;
  v_idle_state  attend_ticket_state;
begin
  select * into v_transfer from attend_ticket_transfers where id = v_transfer_id for update;
  if v_transfer.id is null then
    return jsonb_build_object('ok', false, 'error', 'Transfer not found.');
  end if;
  if v_transfer.from_profile_id <> v_actor then
    return jsonb_build_object('ok', false, 'error', 'This is not your transfer to revoke.');
  end if;
  if v_transfer.status <> 'PENDING' then
    return jsonb_build_object('ok', false, 'error', 'Only a pending transfer can be revoked.');
  end if;

  select * into v_ticket from attend_tickets where id = v_transfer.ticket_id for update;
  select buyer_id into v_buyer from attend_orders where id = v_ticket.order_id;
  v_idle_state := case
    when v_ticket.owner_id = v_buyer then 'ASSIGNED_TO_BUYER'::attend_ticket_state
    else 'TRANSFER_ACCEPTED'::attend_ticket_state
  end;

  update attend_ticket_transfers
     set status = 'REVOKED', revoked_at = now() where id = v_transfer_id;
  update attend_tickets
     set state = v_idle_state, updated_at = now() where id = v_ticket.id;

  return jsonb_build_object('ok', true, 'ticket_state', v_idle_state);
end $$;
