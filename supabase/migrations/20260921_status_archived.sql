-- Статус 'archived' — прибраний із сайту запис, якого ми не змогли підтвердити.
--
-- 30.08–01.09.2026 гурткові скрапери поклали в базу 421 постійний гурток із
-- довідників gurtok.org (350, усі — Житомир) і «Школяр» (71). У довідниках
-- немає жодної дати, а сайт організатора підтвердив гурток в 1 випадку з 27
-- (сухий прогін scraper/audit_clubs.py 21.09.2026: у 11 сайту не знайшов
-- навіть вебпошук, у 4 він мертвий, у 12 про гурток мовчить). Марія вирішила
-- прибрати їх без повного прогону.
--
-- Чому не наявні статуси. 'draft' — черга модерації: 421 запис поховав би
-- там 20 справжніх чернеток. 'closed' — публічна сторінка з плашкою «вже
-- завершилась», а про ці гуртки ми цього не знаємо. 'archived' сайт не
-- показує: сторінка тимчасово переадресовує на головну (app/o/shared.js),
-- списки, sitemap, черга модерації й фонові перевірки беруть лише active /
-- closed / draft, а повторна розмітка статус архівного запису не змінює
-- (scraper/db.py merge_patch).
--
-- Повернути запис: update opportunities set status = 'active' where id = ...

alter table opportunities drop constraint if exists opportunities_status_check;
alter table opportunities add constraint opportunities_status_check
  check (status = any (array['active', 'closed', 'draft', 'archived']));
alter table opportunities drop constraint if exists opportunities_status_enum;
alter table opportunities add constraint opportunities_status_enum
  check (status = any (array['active', 'closed', 'draft', 'archived']));

-- Самі 421 запис. Схвалені людиною (verified_at) не чіпаємо.
update opportunities
set status = 'archived',
    admin_comment = left(coalesce(admin_comment || ' · ', '') ||
      'перевірка гуртків 2026-09-21: в архіві — довідник без дат, сайт організатора не підтверджує (рішення Марії)', 500),
    updated_at = now()
where status = 'active'
  and canonical_slug is null
  and verified_at is null
  and opportunity_type in ('club', 'course')
  and timing_kind = 'permanent'
  and source ~* '(gurtok\.org|shkolyar\.org\.ua)';
