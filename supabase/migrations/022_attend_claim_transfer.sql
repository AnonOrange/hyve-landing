-- HYVE Attend — attend_claim_transfer RPC body (replaces the Phase 1 stub).
-- Atomically reassigns a pending transfer's ticket to the recipient. Returns
-- { ok, error? } — an expired/taken/invalid link does not raise.
create or replace function attend_claim_transfer(p_args jsonb)
returns jsonb language plpgsql as $$
declare
  v_token     text := nullif(p_args->>'claim_token', '');
  v_code      text := nullif(p_args->>'friend_code', '');
  v_recipient uuid := (p_args->>'recipient_id')::uuid;
  v_transfer  attend_ticket_transfers%rowtype;
  v_ticket    attend_tickets%rowtype;
begin
  if v_token is not null then
    select * into v_transfer from attend_ticket_transfers where claim_token = v_token for update;
  elsif v_code is not null then
    select * into v_transfer from attend_ticket_transfers where friend_code = v_code for update;
  else
    return jsonb_build_object('ok', false, 'error', 'A claim link or friend code is required.');
  end if;

  if v_transfer.id is null then
    return jsonb_build_object('ok', false, 'error', 'This transfer link is not valid.');
  end if;
  if v_transfer.status <> 'PENDING' then
    return jsonb_build_object('ok', false, 'error', 'This transfer is no longer available.');
  end if;
  if now() >= v_transfer.expires_at then
    return jsonb_build_object('ok', false, 'error', 'This transfer has expired.');
  end if;
  if v_transfer.from_profile_id = v_recipient then
    return jsonb_build_object('ok', false, 'error', 'You cannot claim your own transfer.');
  end if;

  -- A ticket has at most one PENDING transfer at a time (opening one moves it
  -- out of the idle set), so the lock on the transfer above already serializes
  -- concurrent claims of this ticket.
  select * into v_ticket from attend_tickets where id = v_transfer.ticket_id for update;
  if v_ticket.state not in ('TRANSFER_PENDING_EMAIL', 'TRANSFER_PENDING_FRIEND_CODE') then
    return jsonb_build_object('ok', false, 'error', 'This ticket is no longer awaiting a claim.');
  end if;

  update attend_ticket_transfers
     set status = 'ACCEPTED', to_profile_id = v_recipient, accepted_at = now()
   where id = v_transfer.id;

  update attend_tickets
     set state = 'TRANSFER_ACCEPTED', owner_id = v_recipient, updated_at = now()
   where id = v_ticket.id;

  return jsonb_build_object('ok', true, 'ticket_id', v_ticket.id, 'event_id', v_ticket.event_id);
end $$;
