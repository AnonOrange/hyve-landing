-- HYVE Attend — add the Stripe Checkout session id to attend_payments.
-- A Checkout session always carries an id, whereas the PaymentIntent may be
-- absent on the webhook's session object — so the session id is the reliable
-- idempotency key for registration-fee fulfilment.

alter table attend_payments
  add column if not exists stripe_checkout_session_id text;

create index if not exists idx_attend_payments_checkout_session
  on attend_payments (stripe_checkout_session_id);
