-- Дві різні перевірки — два різні поля (20.09.2026).
--
-- last_verified_at ставить щоденна перевірка лінків: вона знає лише те, що
-- адреса відповідає. На сторінці можливості це показувалось як «Перевірено
-- сьогодні» — на всіх 1100 записах, бо пінг проходить щоночі. Слово обіцяло
-- більше, ніж було зроблено. Зміст сторінки читає планова перевірка
-- (lifecycle.py), і саме її дату тепер видно людям.
alter table opportunities
  add column if not exists content_checked_at timestamptz;

comment on column opportunities.content_checked_at is
  'Коли планова перевірка востаннє прочитала сторінку джерела й зрозуміла стан набору. На відміну від last_verified_at (пінг лінка) — це перевірка змісту.';

-- Бекфіл із слідів lifecycle в admin_comment.
update opportunities
set content_checked_at = (regexp_match(admin_comment, 'lifecycle (\d{4}-\d{2}-\d{2})'))[1]::date
where content_checked_at is null
  and admin_comment ~ 'lifecycle \d{4}-\d{2}-\d{2}';

-- Хабові сторінки: одна адреса на кілька РІЗНИХ можливостей, тож тригер
-- дедуплікації не сміє вважати другу дублем першої. Київська й Кіровоградська
-- МАН, табори фонду «Голоси дітей», перелік черкаських пільг одним PDF.
insert into dedup_hub_urls (url_prefix) values
  ('https://kman.kyiv.ua'),
  ('https://man.kr.ua'),
  ('https://voices.org.ua/kempy'),
  ('https://chmr.golos.net.ua/files')
on conflict do nothing;
