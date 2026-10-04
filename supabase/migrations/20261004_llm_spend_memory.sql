-- Не платити двічі за ту саму роботу моделі (04.10.2026).
--
-- 03.10.2026 закінчився баланс Anthropic API. Дві нічні задачі щоразу робили
-- наново те, що вже було зроблено:
--
-- 1. auto_review.py (auto-review.yml) щоночі питав суддю-Haiku про КОЖНУ
--    чернетку, що пройшла механіку, — хоча більшість черги не мінялась
--    тижнями. Тепер слово судді лежить в auto_review разом із хешем того, що
--    він бачив: {"hash", "corridor", "reason", "verdict", "model", "at"}.
--    Хеш той самий — суддю не кличемо; змінилось будь-яке поле — питаємо знову.
--
-- 2. translate_en.py (translate-en.yml) вважав переклад застарілим, коли
--    updated_at > translated_at. Але updated_at рухають і повторна
--    екстракція, і планові перевірки, тож незмінні тексти перекладались наново.
--    Тепер translated_hash — md5 тексту, з якого зроблено переклад; застарілим
--    вважається лише запис, чий текст відтоді змінився.
--
-- Формула хешу мусить побайтно збігатися з text_hash() у scraper/translate_en.py
-- (там вона ж рядком HASH_SQL; тест tests/test_translate_hash.py звіряє обидві).
-- NULL і порожній рядок дають одне й те саме — translate_en їх теж не розрізняє.
--
-- Код терпить незастосовану міграцію: без колонок auto_review працює без
-- памʼяті, а translate_en — за старим правилом updated_at. Тож порядок
-- «спершу міграція, потім мердж» бажаний, але не аварійний.
--
-- Міграція ідемпотентна: повторний запуск нічого не зламає.

alter table public.opportunities add column if not exists auto_review jsonb;
alter table public.opportunities add column if not exists translated_hash text;

comment on column public.opportunities.auto_review is
  'Остання відповідь судді auto_review.py і хеш того, що він бачив (04.10.2026).';
comment on column public.opportunities.translated_hash is
  'md5 тексту (title, summary, details), з якого зроблено англійський переклад; '
  'формула — HASH_SQL у scraper/translate_en.py (04.10.2026).';

-- Хеш для тих, чий переклад на момент міграції свіжий за старим правилом
-- (updated_at не пізніше translated_at; без updated_at старий код теж вважав
-- переклад свіжим). Застарілі лишаються NULL — і перекладуться ще раз, один
-- раз, як і перекладались би без цієї зміни.
update public.opportunities
   set translated_hash = md5(coalesce(title, '') || chr(31) || coalesce(summary, '') || chr(31) || coalesce(details, ''))
 where translated_hash is null
   and translated_at is not null
   and (updated_at is null or updated_at <= translated_at);

-- Перевірка після застосування (stale — скільки записів перекладеться ще раз):
--   select count(*) filter (where translated_hash is not null) as hashed,
--          count(*) filter (where translated_at is not null and translated_hash is null) as stale
--     from public.opportunities
--    where status = 'active' and canonical_slug is null;
