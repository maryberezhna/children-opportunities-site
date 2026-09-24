-- Telegram-канали в реєстр джерел: один канал — один рядок.
--
-- Навіщо. Канали жили списком у scraper/scrapers/telegram_web.py, і вимикач
-- був один на всі чотирнадцять. Заміри 24.09.2026 (10 днів, сирих → записів):
--   Твій космос можливостей      67 → 22   (33%)
--   Можливості                   22 →  6   (27%)
--   In Omnia Paratus              5 →  2
--   United Youth                  2 →  1
--   UNICEF Ukraine                6 →  0   ← 23 тис. знаків у LLM намарно
--   Українська волонтерська служба 7 → 0   ← 34 тис. знаків
--   Молодь України                4 →  0   ←  5 тис. знаків
-- Вимкнути три нульові, не втративши «Твій космос», було неможливо без
-- деплою — саме тому вони й далі працювали (розмова з Марією 23.09.2026
-- «де ми зря витрачаємо ресурси»).
--
-- pipeline='telegram' навмисно окремий від 'python': main.py читає реєстр
-- своїх скраперів за 'python', і канали не мають потрапляти в той список —
-- інакше кожен канал виглядав би там джерелом, яке ніхто не обходить.
-- Рядок «Telegram (веб)» там лишається загальним вимикачем усього скрапера.
--
-- handle у config — те саме, що в t.me/s/<handle>.

alter table public.sources drop constraint if exists sources_pipeline_check;
alter table public.sources add constraint sources_pipeline_check
  check (pipeline = any (array['python', 'node', 'agent', 'telegram']));

insert into public.sources (name, pipeline, adapter, enabled, trust_tier, config, categories, notes)
values
  ('Грантотека',                     'telegram', 'telegram', true,  2, '{"handle": "grantoteka"}',              '{}', null),
  ('Молодь України',                 'telegram', 'telegram', false, 2, '{"handle": "youth_ukraine"}',           '{}', '24.09.2026: вимкнено за віддачею — 4 сторінки за 10 днів, 0 записів'),
  ('Олімпіади України',              'telegram', 'telegram', true,  2, '{"handle": "olymp_ua"}',                '{}', null),
  ('UNICEF Ukraine',                 'telegram', 'telegram', false, 2, '{"handle": "unicef_ukraine"}',          '{}', '24.09.2026: вимкнено за віддачею — 6 сторінок за 10 днів, 0 записів, 23 тис. знаків у LLM'),
  ('Можливості UA',                  'telegram', 'telegram', true,  2, '{"handle": "mozhlyvosti_ua"}',          '{}', null),
  ('Можливості',                     'telegram', 'telegram', true,  2, '{"handle": "Mozhlyvosti"}',             '{}', '27% прийнятих за 10 днів'),
  ('Твій космос можливостей',        'telegram', 'telegram', true,  2, '{"handle": "tviyspace"}',               '{}', 'найкращий канал: 33% прийнятих за 10 днів'),
  ('United Youth',                   'telegram', 'telegram', true,  2, '{"handle": "news_from_united_youth"}',  '{}', null),
  ('In Omnia Paratus',               'telegram', 'telegram', true,  2, '{"handle": "alwaysinomniaparatus"}',    '{}', null),
  ('FLEX Alumni Ukraine',            'telegram', 'telegram', true,  2, '{"handle": "flexalumniukraine"}',       '{}', null),
  ('EducationUSA Ukraine',           'telegram', 'telegram', true,  2, '{"handle": "educationusaukraine"}',     '{}', null),
  ('Goethe-Institut Ukraine',        'telegram', 'telegram', true,  2, '{"handle": "goetheukraine"}',           '{}', 'пише ~раз на місяць — мала кількість тут нормальна'),
  ('Українська волонтерська служба', 'telegram', 'telegram', false, 2, '{"handle": "volunteercountry"}',        '{}', '24.09.2026: вимкнено за віддачею — 7 сторінок за 10 днів, 0 записів, 34 тис. знаків у LLM')
on conflict (name) do nothing;
