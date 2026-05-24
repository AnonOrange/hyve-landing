-- HYVE Attend — Tier 3: allow the SPLAT (Gaussian splatting) asset tier.
-- A splat is a point cloud with no surfaces, so a SPLAT asset also carries a
-- parallel proxy .glb (manifest.asset.splatProxy) for anchors + navigation.
alter table attend_venue_assets drop constraint if exists attend_venue_assets_tier_check;
alter table attend_venue_assets
  add constraint attend_venue_assets_tier_check
  check (tier in ('PANO_360','NAV_MESH','SPLAT'));
