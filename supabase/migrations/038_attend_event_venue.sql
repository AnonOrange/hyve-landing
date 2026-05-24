-- HYVE Attend — link an event to a venue (nullable). When set, the event room
-- can offer a 3D venue view with the live stream mounted on the stage screen.
alter table attend_events add column if not exists venue_id uuid references attend_venues(id);
create index if not exists idx_attend_events_venue on attend_events (venue_id) where deleted_at is null;
