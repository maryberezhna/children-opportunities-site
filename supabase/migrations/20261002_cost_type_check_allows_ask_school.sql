-- «Вартість уточнюйте в школі» все ще не проходила в базу (02.10.2026).
--
-- Міграція 20260928_ask_school_and_mon_cells.sql мала дозволити
-- cost_type = 'ask_school'. Вона знімала обмеження з назвою
-- opportunities_cost_type_enum — а записи відкидає обмеження, яке насправді
-- зветься opportunities_cost_type_check. «drop constraint if exists» на чужу
-- назву тихо не зробив нічого, після чого поряд народилось друге, дозвільне
-- обмеження — і найсуворіше з двох, як завжди, перемогло.
--
-- Видно це стало лише з повного прогону: 02.10.2026 за один нічний скрап
-- 24 upserti впали з «violates check constraint opportunities_cost_type_check»,
-- і всі 24 — суботні школи діаспори з МІОК та реєстру МОН. Тобто напрям, який
-- Марія назвала пріоритетним 28.09, не міг зберегтись у базу ні разу з того дня.
--
-- Тут знімаємо ОБА імені — і справжнє, і те, що додала попередня міграція, —
-- і ставимо одне. Перелік значень мусить збігатися з COST у
-- app/api/admin/edit/route.js; за цим стоїть тест tests/cost-types.test.mjs.
alter table public.opportunities drop constraint if exists opportunities_cost_type_check;
alter table public.opportunities drop constraint if exists opportunities_cost_type_enum;

alter table public.opportunities
  add constraint opportunities_cost_type_check
  check (cost_type is null or cost_type in
    ('free', 'partially_free', 'paid_affordable', 'paid_premium', 'subsidized', 'ask_school'));

-- Перевірка після застосування: має бути РІВНО одне обмеження на це поле.
--   select conname, pg_get_constraintdef(oid)
--     from pg_constraint
--    where conrelid = 'public.opportunities'::regclass
--      and pg_get_constraintdef(oid) ilike '%cost_type%';
