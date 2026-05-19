-- HYVE Attend — the settlement RPCs (spec §16). attend_release_payout replaces
-- the migration-014 stub; attend_settle_event is new.
--
-- attend_settle_event moves a finished (ENDED) event into settlement. The
-- artist's net is computed by the TypeScript caller (settlement-math.ts) and
-- passed as amount_cents. With a positive net and a payout account on file it
-- creates a HELD payout and sends the event to SETTLEMENT_HOLD; otherwise the
-- event settles immediately (SETTLED) with no payout. Idempotent: only an
-- ENDED event is acted on.
create or replace function attend_settle_event(p_args jsonb)
returns jsonb language plpgsql as $$
declare
  v_event_id   uuid := (p_args->>'event_id')::uuid;
  v_amount     int  := (p_args->>'amount_cents')::int;
  v_event      attend_events%rowtype;
  v_account_id uuid;
  v_payout_id  uuid;
begin
  select * into v_event from attend_events where id = v_event_id for update;
  if v_event.id is null then
    raise exception 'attend_settle_event: event % not found', v_event_id;
  end if;
  if v_event.status <> 'ENDED' then
    return jsonb_build_object('event_id', v_event_id, 'settled', false,
      'reason', 'not awaiting settlement');
  end if;

  select pa.id into v_account_id
    from attend_payout_accounts pa
   where pa.profile_id = v_event.creator_id;

  -- Nothing to pay (free event / no revenue / fully refunded) or no payout
  -- account on file -> the event settles immediately with no payout row.
  if v_amount <= 0 or v_account_id is null then
    update attend_events set status = 'SETTLED', updated_at = now()
     where id = v_event_id;
    return jsonb_build_object('event_id', v_event_id, 'settled', true, 'payout', false);
  end if;

  -- A configured hold window (§16): funds rest before release.
  insert into attend_payouts
    (event_id, payout_account_id, amount_cents, status, scheduled_release_at)
  values
    (v_event_id, v_account_id, v_amount, 'HELD', now() + interval '7 days')
  returning id into v_payout_id;

  update attend_events set status = 'SETTLEMENT_HOLD', updated_at = now()
   where id = v_event_id;

  return jsonb_build_object('event_id', v_event_id, 'settled', true,
    'payout', true, 'payout_id', v_payout_id);
end $$;

-- attend_release_payout records a released payout. The Stripe Connect transfer
-- is performed by the caller before this runs (deduplicated by an idempotency
-- key); this writes the result atomically: the payout -> RELEASED, a signed
-- PAYOUT_RELEASED ledger entry, and the event -> SETTLED. Idempotent: a payout
-- already RELEASED is a safe no-op. A net-negative event (refunds exceeded
-- sales) releases $0 and leaves residual pending net in the ledger — a
-- clawback from the artist is a later concern, not a bug to "fix" here.
create or replace function attend_release_payout(p_args jsonb)
returns jsonb language plpgsql as $$
declare
  v_payout_id uuid := (p_args->>'payout_id')::uuid;
  v_amount    int  := (p_args->>'final_amount_cents')::int;
  v_transfer  text := nullif(p_args->>'stripe_transfer_id', '');
  v_payout    attend_payouts%rowtype;
begin
  select * into v_payout from attend_payouts where id = v_payout_id for update;
  if v_payout.id is null then
    raise exception 'attend_release_payout: payout % not found', v_payout_id;
  end if;
  if v_payout.status = 'RELEASED' then
    return jsonb_build_object('payout_id', v_payout_id, 'status', 'RELEASED',
      'already_done', true);
  end if;

  update attend_payouts
     set status = 'RELEASED', amount_cents = v_amount, stripe_transfer_id = v_transfer,
         released_at = now(), updated_at = now()
   where id = v_payout_id;

  -- Ledger: the payout discharges the artist's pending net (a negative entry,
  -- so the event ledger nets to zero once paid).
  insert into attend_ledger_entries
    (event_id, type, amount_cents, currency, description, source)
  values
    (v_payout.event_id, 'PAYOUT_RELEASED', -v_amount,
     coalesce(v_payout.currency, 'usd'), 'Artist payout released', 'SYSTEM');

  update attend_events set status = 'SETTLED', updated_at = now()
   where id = v_payout.event_id and status = 'SETTLEMENT_HOLD';

  return jsonb_build_object('payout_id', v_payout_id, 'status', 'RELEASED');
end $$;
