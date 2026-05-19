-- HYVE Attend — attend_create_transfer RPC. Atomically opens a ticket
-- transfer: inserts the attend_ticket_transfers row and moves the ticket to a
-- TRANSFER_PENDING_* state. Returns { ok, error? } — expected user-facing
-- failures do not raise.
create or replace function attend_create_transfer(p_args jsonb)
returns jsonb language plpgsql as $$
declare
  v_ticket_id   uuid := (p_args->>'ticket_id')::uuid;
  v_from        uuid := (p_args->>'from_profile_id')::uuid;
  v_method      text := p_args->>'method';
  v_ticket      attend_tickets%rowtype;
  v_event       attend_events%rowtype;
  v_new_state   attend_ticket_state;
  v_transfer_id uuid;
begin
  select * into v_ticket from attend_tickets where id = v_ticket_id for update;
  if v_ticket.id is null then
    return jsonb_build_object('ok', false, 'error', 'Ticket not found.');
  end if;
  if v_ticket.owner_id is null or v_ticket.owner_id <> v_from then
    return jsonb_build_object('ok', false, 'error', 'This is not your ticket.');
  end if;
  if v_ticket.state not in ('ASSIGNED_TO_BUYER', 'TRANSFER_ACCEPTED') then
    return jsonb_build_object('ok', false, 'error', 'This ticket cannot be transferred right now.');
  end if;

  select * into v_event from attend_events where id = v_ticket.event_id;
  if v_event.starts_at is not null
     and now() >= v_event.starts_at - make_interval(hours => v_event.transfer_cutoff_hours) then
    return jsonb_build_object('ok', false, 'error', 'The transfer window for this event has closed.');
  end if;

  v_new_state := case
    when v_method = 'FRIEND_CODE' then 'TRANSFER_PENDING_FRIEND_CODE'::attend_ticket_state
    else 'TRANSFER_PENDING_EMAIL'::attend_ticket_state
  end;

  insert into attend_ticket_transfers
    (ticket_id, from_profile_id, to_email, method, claim_token, friend_code, status, expires_at)
  values
    (v_ticket_id, v_from, nullif(p_args->>'to_email', ''), v_method,
     nullif(p_args->>'claim_token', ''), nullif(p_args->>'friend_code', ''),
     'PENDING', (p_args->>'expires_at')::timestamptz)
  returning id into v_transfer_id;

  update attend_tickets set state = v_new_state, updated_at = now() where id = v_ticket_id;

  return jsonb_build_object('ok', true, 'transfer_id', v_transfer_id, 'ticket_state', v_new_state);
end $$;
