-- HYVE Attend — attend_request_refund RPC + two refund-request columns.
-- A buyer opens a refund request for one ticket. Atomic: it captures the
-- ticket's pre-request state and the per-ticket price, inserts the request,
-- and locks the ticket into REFUND_REQUESTED (which also blocks transfers and
-- room entry). Returns { ok, error? } — a guard failure does not raise.

alter table attend_refund_requests
  add column if not exists amount_cents int;
alter table attend_refund_requests
  add column if not exists ticket_prior_state attend_ticket_state;

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
