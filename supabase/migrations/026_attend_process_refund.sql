-- HYVE Attend — the two refund-resolution RPCs. attend_process_refund replaces
-- the migration-014 stub; attend_deny_refund is new. Both lock the request row
-- FOR UPDATE, so a concurrent approve and deny serialise cleanly.
--
-- attend_process_refund records a *completed* refund: request -> PROCESSED,
-- ticket -> REFUNDED, a REFUND payment row, a signed REFUND_DEBIT ledger entry,
-- and the order rolled to PARTIALLY_REFUNDED / REFUNDED. Idempotent on
-- PROCESSED. The Stripe refund is issued by the caller before this runs
-- (deduplicated by an idempotency key), so this finalises from any
-- non-PROCESSED status — including a request a concurrent deny just moved to
-- DENIED: the money has moved, so the PROCESSED record must win.
create or replace function attend_process_refund(p_args jsonb)
returns jsonb language plpgsql as $$
declare
  v_request_id uuid := (p_args->>'refund_request_id')::uuid;
  v_reviewer   uuid := (p_args->>'reviewer_id')::uuid;
  v_refund_id  text := nullif(p_args->>'stripe_refund_id', '');
  v_pi         text := nullif(p_args->>'stripe_payment_intent_id', '');
  v_amount     int  := (p_args->>'amount_cents')::int;
  v_request    attend_refund_requests%rowtype;
  v_order      attend_orders%rowtype;
  v_payment_id uuid;
  v_remaining  int;
begin
  select * into v_request from attend_refund_requests where id = v_request_id for update;
  if v_request.id is null then
    raise exception 'attend_process_refund: refund request % not found', v_request_id;
  end if;
  if v_request.status = 'PROCESSED' then
    return jsonb_build_object('refund_request_id', v_request_id,
      'status', 'PROCESSED', 'already_done', true);
  end if;

  select * into v_order from attend_orders where id = v_request.order_id for update;

  -- Refund payment record (kind REFUND).
  insert into attend_payments
    (kind, order_id, event_id, profile_id, amount_cents, currency, status,
     stripe_payment_intent_id, stripe_refund_id)
  values
    ('REFUND', v_request.order_id, v_request.event_id, v_request.requester_id,
     v_amount, v_order.currency, 'SUCCEEDED', v_pi, v_refund_id)
  returning id into v_payment_id;

  -- Signed ledger debit — a refund reduces the artist's pending net.
  insert into attend_ledger_entries
    (event_id, order_id, payment_id, ticket_id, type, amount_cents, currency,
     description, source, created_by)
  values
    (v_request.event_id, v_request.order_id, v_payment_id, v_request.ticket_id,
     'REFUND_DEBIT', -v_amount, v_order.currency, 'Refund to buyer', 'HUMAN',
     v_reviewer::text);

  update attend_tickets
     set state = 'REFUNDED', updated_at = now()
   where id = v_request.ticket_id;

  update attend_refund_requests
     set status = 'PROCESSED', resolved_by = v_reviewer, resolved_at = now(),
         updated_at = now()
   where id = v_request_id;

  -- Order rollup: REFUNDED once no ticket on the order is still an outstanding
  -- paid seat (CANCELLED / EXPIRED tickets are not outstanding), else
  -- PARTIALLY_REFUNDED.
  select count(*) into v_remaining
    from attend_tickets
   where order_id = v_request.order_id
     and state not in ('REFUNDED', 'CANCELLED', 'EXPIRED');
  update attend_orders
     set status = case when v_remaining = 0 then 'REFUNDED' else 'PARTIALLY_REFUNDED' end,
         updated_at = now()
   where id = v_request.order_id;

  return jsonb_build_object('refund_request_id', v_request_id, 'status', 'PROCESSED');
end $$;

-- attend_deny_refund — resolve a refund request as DENIED and return the
-- ticket to the state it held before the request (which unlocks transfers and
-- room entry). Locks the request row FOR UPDATE, so it is race-safe against a
-- concurrent approve. Structured { ok, error? } return: a PROCESSED request is
-- refused; an already-DENIED request is an idempotent no-op.
create or replace function attend_deny_refund(p_args jsonb)
returns jsonb language plpgsql as $$
declare
  v_request_id uuid := (p_args->>'refund_request_id')::uuid;
  v_reviewer   uuid := (p_args->>'reviewer_id')::uuid;
  v_request    attend_refund_requests%rowtype;
begin
  select * into v_request from attend_refund_requests where id = v_request_id for update;
  if v_request.id is null then
    return jsonb_build_object('ok', false, 'error', 'Refund request not found.');
  end if;
  if v_request.status = 'PROCESSED' then
    return jsonb_build_object('ok', false,
      'error', 'This refund has already been processed and cannot be denied.');
  end if;
  if v_request.status = 'DENIED' then
    return jsonb_build_object('ok', true, 'already_done', true);
  end if;

  if v_request.ticket_prior_state is not null then
    update attend_tickets
       set state = v_request.ticket_prior_state, updated_at = now()
     where id = v_request.ticket_id;
  end if;

  update attend_refund_requests
     set status = 'DENIED', resolved_by = v_reviewer, resolved_at = now(),
         updated_at = now()
   where id = v_request_id;

  return jsonb_build_object('ok', true);
end $$;
