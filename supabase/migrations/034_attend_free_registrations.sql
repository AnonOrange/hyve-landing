-- HYVE Attend — first 2 shows are free.
--
-- A creator's first two registered shows skip the $50 promotion registration
-- fee but otherwise behave identically: the promotion campaign is created at
-- the same budget so promotion mechanics are unchanged, and the platform
-- percentage on ticket sales is preserved (no change to settlement).
--
-- A free slot is consumed when attend_grant_free_registration succeeds for an
-- event. Soft-deleting an event releases its credit (the count filters on
-- deleted_at IS NULL), so cancelling a show doesn't permanently burn a slot.

alter table attend_events
  add column if not exists was_free_registration boolean not null default false;

-- Tight partial index — count queries only ever look at the live free-flagged
-- rows for a given creator, never a full table scan.
create index if not exists idx_attend_events_creator_free
  on attend_events (creator_id)
  where was_free_registration = true and deleted_at is null;

create or replace function attend_grant_free_registration(p_args jsonb)
returns jsonb language plpgsql as $$
declare
  v_event_id   uuid := (p_args->>'event_id')::uuid;
  v_actor      text := coalesce(p_args->>'actor', 'system');
  v_creator_id uuid;
  v_status     attend_event_status;
  v_was_free   boolean;
  v_used_count int;
  v_free_cap   constant int := 2;
begin
  -- Lock the event row up-front so two concurrent grant attempts on the same
  -- event can't both succeed.
  select creator_id, status, was_free_registration
    into v_creator_id, v_status, v_was_free
    from attend_events
   where id = v_event_id
   for update;

  if v_creator_id is null then
    raise exception 'attend_grant_free_registration: event % not found', v_event_id;
  end if;

  -- Idempotent on the event: if the event already moved past
  -- REGISTRATION_PENDING (whether free or paid), report the prior outcome.
  if v_status <> 'REGISTRATION_PENDING' then
    return jsonb_build_object(
      'event_id', v_event_id,
      'status', v_status,
      'free', v_was_free,
      'already_done', true
    );
  end if;

  -- Count this creator's currently-live free-registered events. We can't lock
  -- the creator's other rows from inside this transaction, but a creator
  -- racing two browser tabs would have to fire two pay-registration POSTs at
  -- once on different events — extremely rare, and the worst case is they
  -- get one extra free show, which is an acceptable failure mode.
  select count(*)::int
    into v_used_count
    from attend_events
   where creator_id = v_creator_id
     and was_free_registration = true
     and deleted_at is null;

  if v_used_count >= v_free_cap then
    raise exception 'attend_grant_free_registration: NO_FREE_CREDITS'
      using errcode = 'P0001';
  end if;

  update attend_events
     set status = 'PROMOTION_FEE_PAID',
         was_free_registration = true,
         updated_at = now(),
         updated_by = v_actor
   where id = v_event_id;

  -- Same campaign creation as the paid path, so all downstream promotion
  -- code (impression/click tracking, featured ranking, etc.) is unchanged.
  insert into attend_promotion_campaigns (event_id, budget_cents, status)
  values (v_event_id, 5000, 'ACTIVE')
  on conflict (event_id) do nothing;

  return jsonb_build_object(
    'event_id', v_event_id,
    'status', 'PROMOTION_FEE_PAID',
    'free', true,
    'used', v_used_count + 1,
    'remaining', v_free_cap - (v_used_count + 1)
  );
end $$;
