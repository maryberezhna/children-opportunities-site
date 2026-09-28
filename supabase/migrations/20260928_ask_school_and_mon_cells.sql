-- «Вартість уточнюйте в школі» і реєстр МОН «Осередки за кордоном» (28.09.2026).
--
-- 1. cost_type = 'ask_school' — виняток із пʼяти обовʼязкових полів ЛИШЕ для
--    шкіл і студій діаспори (рішення Марії 28.09.2026). Хто має право на це
--    значення, вирішує не база, а lib/publish-criteria.json
--    (required.cost.ask_school): Python (scraper/proof.py) і JS
--    (lib/required.js) читають одне визначення. База лише перестає відкидати
--    саме значення. Фільтри сайту рахують «безкоштовно» лише за 'free',
--    тож такий запис безкоштовним не стає.
alter table public.opportunities drop constraint if exists opportunities_cost_type_enum;
alter table public.opportunities
  add constraint opportunities_cost_type_enum
  check (cost_type is null or cost_type in
    ('free', 'partially_free', 'paid_affordable', 'paid_premium', 'subsidized', 'ask_school'));

-- 2. Джерело: реєстр осередків МОН в АІКОМ. Держава — перший рівень довіри;
--    реєстр оновлюється рідко, обхід раз на місяць (закріплений ритм).
insert into public.sources
  (name, pipeline, adapter, enabled, trust_tier, config, categories, notes,
   crawl_interval_days, pin_interval, next_crawl_at)
values
  ('Реєстр осередків за кордоном (МОН, aikom.iea.gov.ua)', 'python', 'html', true, 1,
   '{"module": "mon_cells", "url": "https://aikom.iea.gov.ua/cell/cell/cell-list"}',
   '{osvita}',
   'Суботні/недільні школи й освітньо-культурні центри в PL/DE/ES/CZ/IE/IT/NL — одна постійна картка на школу; вартість із поля «Навчання є» (Платне/Безоплатне). Школи повного стандарту, нацменшин і патріотичні організації не беремо. Дубль із МІОК — лишається МІОК (db.school_twin_resolution).',
   30, true, now())
on conflict (name) do nothing;
