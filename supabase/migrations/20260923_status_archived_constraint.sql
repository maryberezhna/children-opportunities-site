-- Статус 'archived' у продакшн-базі.
--
-- 20260921_status_archived.sql написали, але до продакшну не застосували:
-- constraint досі приймав лише active|closed|draft, і жодного архівного
-- запису в базі не було (перевірено 23.09.2026). Через це не працювало
-- нічого, що спирається на архів: app/o/shared.js, merge_patch у scraper/db.py
-- і вибірки, які беруть тільки active/closed/draft.
--
-- Тут ЛИШЕ дозвіл на статус. Масове архівування 421 гуртка з довідників,
-- що стоїть у тій міграції нижче, свідомо НЕ запускаємо: станом на 23.09
-- 420 таких записів досі активні, і це окреме рішення з окремим обсягом.
alter table opportunities drop constraint if exists opportunities_status_check;
alter table opportunities add constraint opportunities_status_check
  check (status = any (array['active', 'closed', 'draft', 'archived']));
alter table opportunities drop constraint if exists opportunities_status_enum;
alter table opportunities add constraint opportunities_status_enum
  check (status = any (array['active', 'closed', 'draft', 'archived']));
