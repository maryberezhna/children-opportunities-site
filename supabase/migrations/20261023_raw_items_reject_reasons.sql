-- raw_items.reject_reason: два коди, які код уже пише, а CHECK не знав.
-- homepage_no_yield — scraper/main.py (головну вже читали, а можливостей вона
-- не дає); broken_output — normalizer.py (зламана розмітка моделі). Без них
-- позначка сирцю падала з 23514, і такі рядки лишались у черзі назавжди
-- (нічні прогони 18, 20–22.10.2026).
alter table public.raw_items drop constraint if exists raw_items_reject_reason_check;
alter table public.raw_items add constraint raw_items_reject_reason_check check (
  reject_reason is null or reject_reason = any (array[
    'low_confidence', 'not_child', 'not_for_kids', 'off_topic', 'dead_link',
    'upsert_failed', 'duplicate', 'unknown', 'homepage_no_yield', 'broken_output'
  ]::text[])
);
