-- HYVE Attend — attend_check_in RPC. Atomically enters a ticket-holder into an
-- event room: closes any prior open attendance session (single active session
-- per ticket), opens a fresh one, and moves the ticket to IN_ROOM. This
-- collapses §7.9's CHECKED_IN -> IN_ROOM pair into one atomic step (the
-- session opens as the holder checks in); CHECKED_IN as a resting state is
-- reached only by the leave / attendance-finalize paths in later phases.
create or replace function attend_check_in(p_args jsonb)
returns jsonb language plpgsql as $$
declare
  v_ticket_id    uuid := (p_args->>'ticket_id')::uuid;
  v_profile_id   uuid := (p_args->>'profile_id')::uuid;
  v_device       text := nullif(p_args->>'device', '');
  v_browser      text := nullif(p_args->>'browser', '');
  v_ip_hash      text := nullif(p_args->>'ip_hash', '');
  v_ticket       attend_tickets%rowtype;
  v_event_status attend_event_status;
  v_session_id   uuid;
begin
  select * into v_ticket from attend_tickets where id = v_ticket_id for update;
  if v_ticket.id is null then
    return jsonb_build_object('ok', false, 'error', 'Ticket not found.');
  end if;
  if v_ticket.owner_id is null or v_ticket.owner_id <> v_profile_id then
    return jsonb_build_object('ok', false, 'error', 'This is not your ticket.');
  end if;
  if v_ticket.state not in
     ('ASSIGNED_TO_BUYER', 'TRANSFER_ACCEPTED', 'CHECKED_IN', 'IN_ROOM') then
    return jsonb_build_object('ok', false, 'error', 'This ticket cannot enter the room.');
  end if;

  select status into v_event_status from attend_events where id = v_ticket.event_id;
  if v_event_status not in ('SOUNDCHECK', 'DOORS_OPEN', 'LIVE') then
    return jsonb_build_object('ok', false, 'error', 'The event room is not open yet.');
  end if;

  -- Single active session per ticket: close any session left open.
  update attend_attendance_sessions
     set left_at = now(),
         watch_seconds = greatest(0, extract(epoch from now() - joined_at)::int)
   where ticket_id = v_ticket_id and left_at is null;

  insert into attend_attendance_sessions
    (ticket_id, profile_id, event_id, device, browser, ip_hash)
  values (v_ticket_id, v_profile_id, v_ticket.event_id, v_device, v_browser, v_ip_hash)
  returning id into v_session_id;

  update attend_tickets
     set state = 'IN_ROOM', checked_in_at = coalesce(checked_in_at, now()), updated_at = now()
   where id = v_ticket_id;

  return jsonb_build_object('ok', true, 'session_id', v_session_id);
end $$;
