-- HYVE Attend — Phase 6b review hardening. Re-defines two refund RPCs:
--  * attend_request_refund — a denied request is now final; the buyer cannot
--    re-open a request on the same ticket once it has been reviewed and denied
--    (a denial restores the ticket to a refundable state, which would
--    otherwise allow unbounded re-requests).
--  * attend_process_refund — the refund amount is now taken from the request
--    row (frozen at request time) rather than a caller-supplied argument, so
--    the RPC cannot be coerced into refunding an arbitrary sum.
-- attend_deny_refund (migration 026) is unchanged.

create or replace function attend_request_refund(p_args jsonb)
returns jsonb language plpgsql as $$
declare
  v_ticket_id  uuid := (p_args->>'ticket_id')::uuid;
  v_requester  uuid := (p_args->>'requester_id')::uuid;
  v_reason     text := nullif(p_args->>'reason', '');
  v_ticket     attend_tickets%rowtype;
  v_amount     int;
  v_request_id uuid;
begin
  select * into v_ticket from attend_tickets where id = v_ticket_id for update;
  if v_ticket.id is null then
    return jsonb_build_object('ok', false, 'error', 'Ticket not found.');
  end if;
  if v_ticket.owner_id is null or v_ticket.owner_id <> v_requester then
    return jsonb_build_object('ok', false, 'error', 'This is not your ticket.');
  end if;
  if v_ticket.state not in
     ('ASSIGNED_TO_BUYER','TRANSFER_ACCEPTED','CHECKED_IN','IN_ROOM','USED','NO_SHOW') then
    return jsonb_build_object('ok', false,
      'error', 'This ticket is not eligible for a refund request.');
  end if;

  -- A formal card dispute on the order routes to the dispute flow, not here (§31).
  if exists (select 1 from attend_disputes where order_id = v_ticket.order_id) then
    return jsonb_build_object('ok', false,
      'error', 'This order is under dispute. Refunds are handled through that process.');
  end if;

  -- A denied request is final: the ticket was restored to a refundable state,
  -- so without this guard the buyer could re-request indefinitely.
  if exists (
    select 1 from attend_refund_requests
     where ticket_id = v_ticket.id and status = 'DENIED'
  ) then
    return jsonb_build_object('ok', false,
      'error', 'A refund request for this ticket was already reviewed and denied.');
  end if;

  -- Per-ticket refund amount: the frozen unit price paid for this tier.
  select unit_price_cents into v_amount
    from attend_order_line_items
   where order_id = v_ticket.order_id and ticket_type_id = v_ticket.ticket_type_id
   order by created_at
   limit 1;

  insert into attend_refund_requests
    (ticket_id, order_id, event_id, requester_id, reason, status,
     amount_cents, ticket_prior_state)
  values
    (v_ticket.id, v_ticket.order_id, v_ticket.event_id, v_requester, v_reason,
     'REQUESTED', coalesce(v_amount, 0), v_ticket.state)
  returning id into v_request_id;

  update attend_tickets
     set state = 'REFUND_REQUESTED', updated_at = now()
   where id = v_ticket.id;

  return jsonb_build_object('ok', true, 'refund_request_id', v_request_id);
end $$;

create or replace function attend_process_refund(p_args jsonb)
returns jsonb language plpgsql as $$
declare
  v_request_id uuid := (p_args->>'refund_request_id')::uuid;
  v_reviewer   uuid := (p_args->>'reviewer_id')::uuid;
  v_refund_id  text := nullif(p_args->>'stripe_refund_id', '');
  v_pi         text := nullif(p_args->>'stripe_payment_intent_id', '');
  v_request    attend_refund_requests%rowtype;
  v_order      attend_orders%rowtype;
  v_amount     int;
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

  -- Trust the amount frozen onto the request row at request time, not the
  -- caller — the RPC must not be coercible into refunding an arbitrary sum.
  v_amount := coalesce(v_request.amount_cents, 0);

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
