-- ============================================================================
-- Eurodesk: посилання на саму програму, а не на весь пошук (22.09.2026).
--
-- Скрапер складав адресу {BASE}/23225-eu. Сайт Eurodesk відповідає на неї
-- 200 — але це його головна сторінка з пошуком на пʼятсот карток, без
-- жодного натяку, яку з них мали на увазі. Так вели на пошук усі записи
-- Eurodesk: 44 активні на сайті й уся модерація (чернетки й карантин).
-- Картку відкриває лише /search/programme/23225/eu — на ній уся програма.
--
-- Ще 16 записів з першого наповнення (18.05.2026) мали «голі» номери, яких
-- у Eurodesk немає взагалі (EPAS лежав як 20152, а справжній — 23225).
-- Справжні номери знайдено за точною назвою в повному переліку Eurodesk
-- і кожну нову адресу перевірено: 200 і та сама назва в <title>.
--
-- Разом із посиланням переписуємо відбитки — інакше наступний прогін
-- прийняв би знайоме за нове:
--   • raw_items.content_hash = sha256(url|text)[:32] — на ньому тримається
--     «відхилене не повертається» (71 відхилений сирець Eurodesk);
--   • opportunities.content_hash = sha256(url)[:16] — ключ upsert-а.
-- Відбиток рахуємо лише там, де він і був порахований цією формулою.
-- Сім пар записів після виправлення ведуть на одну програму (дубль і
-- оригінал, або старий «голий» номер і новий). Новий відбиток дістається
-- одному — активному, далі тому, що не позначений дублем; другий лишає
-- старий, бо відбиток унікальний.
-- ============================================================================

create temporary table eurodesk_remap (old_id text primary key, new_id text not null);
insert into eurodesk_remap values
  ('20149', '23176-eu'),  -- AFS Exchange Programmes
  ('20152', '23225-eu'),  -- European Parliament Ambassador School (EPAS)
  ('20861', '19779-eu'),  -- European Space Camp
  ('20960', '19770-eu'),  -- Plural+ Youth Video Festival
  ('21700', '23021-eu'),  -- UNESCO Global Youth Hackathon
  ('21912', '21295-eu'),  -- EYF Special Call for Ukraine
  ('22037', '23188-eu'),  -- Young European Ambassador (YEA)
  ('22130', '23453-eu'),  -- International Chemistry Competition
  ('22131', '23492-eu'),  -- International Astronomy and Astrophysics Competition
  ('22310', '22348-eu'),  -- Girls Go Circular Student Challenge
  ('22345', '21272-eu'),  -- EUteens4Green
  ('22558', '21205-eu'),  -- Young Inventors Prize
  ('22700', '22713-eu'),  -- Rotary Youth Exchange Programme
  ('22800', '21267-eu'),  -- Global Study Fair
  ('22900', '22213-eu'),  -- Young Champions of the Earth
  ('23100', '22106-eu');  -- beVisioneers Fellowship

-- Стара адреса → нова. «Голий» номер без мови — версія для всієї Європи (eu).
create temporary table eurodesk_url as
select u.old_url,
       'https://programmes.eurodesk.eu/search/programme/' ||
         coalesce(replace(r.new_id, '-', '/'), m[1] || '/' || coalesce(m[2], 'eu')) as new_url
from (
  select source_url as old_url from opportunities
  union select apply_url from opportunities
  union select source_url from raw_items
) u
cross join lateral regexp_match(u.old_url, '^https://programmes\.eurodesk\.eu/(\d+)(?:-([a-z]{2}))?/?$') m
left join eurodesk_remap r on r.old_id = m[1] and m[2] is null
where m is not null;

-- ── Можливості ──────────────────────────────────────────────────────────────
with ranked as (
  select o.id, o.source_url as old_url, u.new_url,
         row_number() over (
           partition by u.new_url
           order by (o.status = 'active') desc, (o.canonical_slug is null) desc, o.created_at
         ) as rn
  from opportunities o
  join eurodesk_url u on u.old_url = o.source_url
)
update opportunities o set
  source_url    = r.new_url,
  canonical_url = r.new_url,
  content_hash  = case
    when r.rn = 1
     and o.content_hash = substr(encode(sha256(convert_to(r.old_url, 'UTF8')), 'hex'), 1, 16)
    then substr(encode(sha256(convert_to(r.new_url, 'UTF8')), 'hex'), 1, 16)
    else o.content_hash
  end
from ranked r
where o.id = r.id;

update opportunities o set apply_url = u.new_url
from eurodesk_url u
where o.apply_url = u.old_url;

-- ── Сирці ───────────────────────────────────────────────────────────────────
update raw_items ri set
  source_url    = u.new_url,
  canonical_url = u.new_url,
  content_hash  = case
    when ri.content_hash = substr(encode(sha256(convert_to(ri.source_url || '|' || ri.raw_text, 'UTF8')), 'hex'), 1, 32)
    then substr(encode(sha256(convert_to(u.new_url || '|' || ri.raw_text, 'UTF8')), 'hex'), 1, 32)
    else ri.content_hash
  end
from eurodesk_url u
where ri.source_url = u.old_url;

drop table eurodesk_url;
drop table eurodesk_remap;
