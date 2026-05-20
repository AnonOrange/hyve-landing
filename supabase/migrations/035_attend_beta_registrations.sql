-- HYVE Attend — beta mode: all shows free of the $50 registration fee.
--
-- Tracked in a column distinct from was_free_registration so the
-- first-2-free welcome offer credits aren't burned during beta —
-- when the founder flips ATTEND_BETA_MODE to false at full launch,
-- every creator still has their full 2-credit allowance intact.

alter table attend_events
  add column if not exists was_beta_registration boolean not null default false;

-- Partial index to keep beta-creator counts cheap when reporting later.
create index if not exists idx_attend_events_creator_beta
  on attend_events (creator_id)
  where was_beta_registration = true and deleted_at is null;

create or replace function attend_grant_beta_registration(p_args jsonb)
returns jsonb language plpgsql as $$
declare
  v_event_id   uuid := (p_args->>'event_id')::uuid;
  v_actor      text := coalesce(p_args->>'actor', 'system');
  v_creator_id uuid;
  v_status     attend_event_status;
  v_was_beta   boolean;
begin
  -- Lock the event row up-front so concurrent grants on the same event
  -- can't both succeed.
  select creator_id, status, was_beta_registration
    into v_creator_id, v_status, v_was_beta
    from attend_events
   where id = v_event_id
   for update;

  if v_creator_id is null then
    raise exception 'attend_grant_beta_registration: event % not found', v_event_id;
  end if;

  -- Idempotent: a retried call on an already-registered event reports
  -- the prior outcome instead of erroring.
  if v_status <> 'REGISTRATION_PENDING' then
    return jsonb_build_object(
      'event_id', v_event_id,
      'status', v_status,
      'beta', v_was_beta,
      'already_done', true
    );
  end if;

  update attend_events
     set status = 'PROMOTION_FEE_PAID',
         was_beta_registration = true,
         updated_at = now(),
         updated_by = v_actor
   where id = v_event_id;

  -- Same campaign creation as the paid path so all downstream
  -- promotion code (impressions, clicks, featured ranking) is
  -- unchanged. Budget reflects the equivalent of the waived fee.
  insert into attend_promotion_campaigns (event_id, budget_cents, status)
  values (v_event_id, 5000, 'ACTIVE')
  on conflict (event_id) do nothing;

  return jsonb_build_object(
    'event_id', v_event_id,
    'status', 'PROMOTION_FEE_PAID',
    'beta', true
  );
end $$;
