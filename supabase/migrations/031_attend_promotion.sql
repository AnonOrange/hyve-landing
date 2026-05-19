-- HYVE Attend — promotion engine (spec §19). The campaign row + budget ledger
-- already exist (attend_pay_registration); this adds the editable ad creative,
-- a unique internal-placement spend row per campaign, and a counter RPC.

alter table attend_promotion_campaigns add column if not exists headline text;
alter table attend_promotion_campaigns add column if not exists body text;
alter table attend_promotion_campaigns
  add column if not exists creative_approved boolean not null default false;

-- One INTERNAL_PLACEMENT spend row per campaign — the counter target.
create unique index if not exists idx_attend_promo_spend_campaign_kind
  on attend_promotion_spend (campaign_id, kind);

-- attend_track_promotion atomically bumps an impression or click counter on
-- the campaign's internal-placement spend row, creating that row on first use.
-- Structured { ok, error? } return — a bad metric or missing campaign is not
-- an exception (the caller is a fire-and-forget tracking beacon).
create or replace function attend_track_promotion(p_args jsonb)
returns jsonb language plpgsql as $$
declare
  v_campaign uuid := (p_args->>'campaign_id')::uuid;
  v_metric   text := p_args->>'metric';
  v_count    int  := greatest(1, coalesce((p_args->>'count')::int, 1));
  v_spend_id uuid;
begin
  if v_metric not in ('impressions', 'clicks') then
    return jsonb_build_object('ok', false, 'error', 'bad metric');
  end if;
  if not exists (select 1 from attend_promotion_campaigns where id = v_campaign) then
    return jsonb_build_object('ok', false, 'error', 'campaign not found');
  end if;

  insert into attend_promotion_spend (campaign_id, kind)
  values (v_campaign, 'INTERNAL_PLACEMENT')
  on conflict (campaign_id, kind) do nothing;
  select id into v_spend_id from attend_promotion_spend
   where campaign_id = v_campaign and kind = 'INTERNAL_PLACEMENT';

  if v_metric = 'impressions' then
    update attend_promotion_spend set impressions = impressions + v_count
     where id = v_spend_id;
  else
    update attend_promotion_spend set clicks = clicks + v_count
     where id = v_spend_id;
  end if;

  return jsonb_build_object('ok', true);
end $$;
