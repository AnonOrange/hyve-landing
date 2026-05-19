-- HYVE Attend — the two remaining §25 lifecycle jobs.
--
-- attend_finalize_attendance resolves an ended event's ticket lifecycle:
-- close any attendance session left open, mark tickets that reached the room
-- USED, and mark sold tickets that never entered NO_SHOW. Tickets in a
-- refund / dispute / transfer-pending state are left untouched. Idempotent —
-- a re-run finds no tickets in the pre-final states.
create or replace function attend_finalize_attendance(p_args jsonb)
returns jsonb language plpgsql as $$
declare
  v_event_id uuid := (p_args->>'event_id')::uuid;
  v_status   attend_event_status;
  v_used     int;
  v_no_show  int;
begin
  select status into v_status from attend_events where id = v_event_id;
  if v_status is null then
    raise exception 'attend_finalize_attendance: event % not found', v_event_id;
  end if;
  -- Only an event that has actually ended is finalized.
  if v_status not in ('ENDED', 'SETTLEMENT_HOLD', 'SETTLED') then
    return jsonb_build_object('event_id', v_event_id, 'finalized', false,
      'reason', 'event has not ended');
  end if;

  -- Close any attendance session left open when the stream ended.
  update attend_attendance_sessions
     set left_at = now(),
         watch_seconds = greatest(watch_seconds,
           extract(epoch from now() - joined_at)::int)
   where event_id = v_event_id and left_at is null;

  -- A ticket that reached the room is USED; a sold ticket that never entered
  -- is a NO_SHOW. (The check-in flow moves an attended ticket to IN_ROOM, so
  -- an attended ticket is never left in ASSIGNED_TO_BUYER.)
  update attend_tickets set state = 'USED', updated_at = now()
   where event_id = v_event_id and state in ('CHECKED_IN', 'IN_ROOM');
  get diagnostics v_used = row_count;

  update attend_tickets set state = 'NO_SHOW', updated_at = now()
   where event_id = v_event_id and state in ('ASSIGNED_TO_BUYER', 'TRANSFER_ACCEPTED');
  get diagnostics v_no_show = row_count;

  return jsonb_build_object('event_id', v_event_id, 'finalized', true,
    'used', v_used, 'no_show', v_no_show);
end $$;

-- attend_expire_stale_transfers sweeps PENDING ticket transfers past their
-- expiry window: the ticket returns to its owner (ASSIGNED_TO_BUYER) and the
-- transfer is marked EXPIRED. The ticket restore runs first, so its subquery
-- still sees the transfers as PENDING. Idempotent — a re-run finds none.
create or replace function attend_expire_stale_transfers(p_args jsonb)
returns jsonb language plpgsql as $$
declare
  v_expired int;
begin
  update attend_tickets set state = 'ASSIGNED_TO_BUYER', updated_at = now()
   where state in ('TRANSFER_PENDING_EMAIL', 'TRANSFER_PENDING_FRIEND_CODE')
     and id in (
       select ticket_id from attend_ticket_transfers
        where status = 'PENDING' and expires_at < now()
     );

  update attend_ticket_transfers set status = 'EXPIRED'
   where status = 'PENDING' and expires_at < now();
  get diagnostics v_expired = row_count;

  return jsonb_build_object('expired', v_expired);
end $$;
