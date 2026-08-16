-- ============================================================================
-- Фаза 2 конвеєра даних: реєстр джерел + шар сирих знахідок
--
-- 1. `sources` — кожне джерело стає рядком з конфігурацією та історією здоров'я,
--    а не модулем коду. Вимкнути джерело = UPDATE enabled=false, без деплою.
--    Лічильники checks/changes живлять адаптивний розклад у Фазі 4.
-- 2. `raw_items` — усе знайдене скраперами спершу лягає сюди і лише потім
--    проходить LLM-екстракцію. Це дає:
--    • збій LLM ≠ втрата даних — сирець лежить зі status='pending' і
--      обробляється наступним запуском;
--    • хеш-гейт: вже бачений вміст (той самий content_hash) не йде в LLM
--      повторно — раніше КОЖЕН запуск переекстрагував усі сторінки щодня;
--    • можливість прогнати покращений промпт по всій історії без
--      повторного скрапінгу.
-- ============================================================================

create table if not exists sources (
  id                    uuid primary key default gen_random_uuid(),
  name                  text unique not null,
  pipeline              text not null check (pipeline in ('python', 'node', 'agent')),
  adapter               text not null check (adapter in (
    'html', 'api', 'rss', 'sitemap', 'telegram', 'instagram', 'facebook',
    'llm_search', 'static')),
  enabled               boolean not null default true,
  -- 1 — держ/офіційні (при злитті дублів їхні поля виграють),
  -- 2 — звичайні організації, 3 — соцмережі й агреговані стрічки.
  trust_tier            smallint not null default 2 check (trust_tier between 1 and 3),
  config                jsonb not null default '{}',
  notes                 text,
  last_crawled_at       timestamptz,
  last_success_at       timestamptz,
  consecutive_failures  integer not null default 0,
  checks_count          integer not null default 0,
  changes_count         integer not null default 0,
  created_at            timestamptz not null default now()
);

alter table sources enable row level security;

create table if not exists raw_items (
  id             uuid primary key default gen_random_uuid(),
  source_name    text not null,
  source_url     text,
  canonical_url  text,
  raw_title      text,
  raw_text       text not null,
  -- sha256(source_url|raw_text)[:32] — ідемпотентність сирого шару:
  -- та сама сторінка з тим самим вмістом вставляється рівно один раз.
  content_hash   text unique not null,
  fetched_at     timestamptz not null default now(),
  status         text not null default 'pending' check (status in (
    'pending',     -- чекає на екстракцію (включно з повторами після збоїв)
    'processed',   -- екстраговано й збережено в opportunities
    'rejected',    -- LLM визначив «не можливість» (агрегатор, дорослі, сміття)
    'failed'       -- вичерпано спроби екстракції — видно в адмінському звіті
  )),
  attempts       integer not null default 0,
  last_error     text,
  processed_at   timestamptz,
  opportunity_id uuid references opportunities(id) on delete set null
);

alter table raw_items enable row level security;

create index if not exists raw_items_pending_idx
  on raw_items (fetched_at) where status = 'pending';
create index if not exists raw_items_source_idx on raw_items (source_name);

-- ---------------------------------------------------------------------------
-- Сід реєстру: фактичний стан обох пайплайнів на 16.08.2026.
-- config поки описовий — Фаза 2b переносить сюди селектори/фільтри,
-- коли адаптери стануть універсальними.
-- ---------------------------------------------------------------------------

insert into sources (name, pipeline, adapter, enabled, trust_tier, config, notes) values
  -- Python (scraper/main.py, щодня 06:00 UTC)
  ('MAN',              'python', 'html',      true,  1, '{"module": "man_contests"}',        'Конкурси МАН: __NEXT_DATA__ JSON'),
  ('Prometheus',       'python', 'sitemap',   true,  2, '{"module": "prometheus"}',          'Безкоштовні демокурси'),
  ('МОН олімпіади',    'python', 'static',    true,  1, '{"module": "mon_olympiads"}',       'Сайт 403 з CI — 25 предметів статикою; кандидат на llm_search'),
  ('Дія.Освіта',       'python', 'html',      true,  1, '{"module": "diia_osvita"}',         'Пагінація до 25 сторінок'),
  ('easy.gov.ua',      'python', 'api',       true,  1, '{"module": "easy_gov"}',            'Публічний REST API'),
  ('Erasmus+ UA',      'python', 'html',      true,  2, '{"module": "erasmus"}',             null),
  ('House of Europe',  'python', 'html',      true,  2, '{"module": "house_of_europe"}',     null),
  ('RSS-стрічки',      'python', 'rss',       true,  2, '{"module": "rss_feeds"}',           '3 стрічки + Google Alerts з env GOOGLE_ALERTS_FEEDS'),
  ('UNICEF',           'python', 'html',      false, 2, '{"module": "unicef"}',              'Мертва заглушка: Cloudflare блокує, повертає [] — вимкнено в реєстрі'),
  ('Save the Children','python', 'html',      true,  2, '{"module": "save_the_children"}',   null),
  ('British Council',  'python', 'html',      true,  2, '{"module": "british_council"}',     null),
  ('Telegram (веб)',   'python', 'telegram',  true,  3, '{"module": "telegram_web", "channels": 11}',      't.me/s/ прев''ю, без ключів'),
  ('Telegram канали',  'python', 'telegram',  true,  3, '{"module": "telegram_channels", "channels": 16}', 'Telethon, потребує TELEGRAM_SESSION_STRING'),
  ('Instagram',        'python', 'instagram', true,  3, '{"module": "instagram_monitor", "accounts": 10}', 'instaloader, no-op без креденшалів'),
  ('Facebook',         'python', 'facebook',  true,  3, '{"module": "facebook_pages", "pages": 10}',       'Graph API v20'),
  -- Node (scrapers/run.mjs, щодня 05:00 UTC)
  ('acmodasi',                    'node', 'html',   true,  3, '{"module": "acmodasi-castings"}',            'Має кураторський фолбек — замінити чесним алертом у 2b'),
  ('fest-portal',                 'node', 'html',   true,  3, '{"module": "fest-portal"}',                  null),
  ('regional-camps',              'node', 'html',   true,  2, '{"module": "regional-camps"}',               'Має кураторський фолбек'),
  ('constellation-ua',            'node', 'html',   true,  2, '{"module": "constellation-ua"}',             null),
  ('international-competitions',  'node', 'html',   true,  2, '{"module": "international-competitions"}',   'Має кураторський фолбек'),
  ('regional-language-schools',   'node', 'html',   true,  2, '{"module": "regional-language-schools"}',    'Має кураторський фолбек'),
  ('eurodesk',                    'node', 'rss',    true,  2, '{"module": "eurodesk"}',                     'RSS за Cloudflare — на CI фолбек'),
  ('egap-stem',                   'node', 'static', true,  2, '{"module": "egap-stem"}',                    'Статичний список, без мережі'),
  ('ucf-grants',                  'node', 'static', true,  1, '{"module": "ucf-grants"}',                   'Статичний список, без мережі'),
  ('man-contests (node)',         'node', 'html',   false, 1, '{"module": "man-contests"}',                 'Вимкнено: дублював Python-версію з іншим content_hash'),
  ('mon-subject-olympiads (node)','node', 'static', false, 1, '{"module": "mon-subject-olympiads"}',        'Вимкнено: дублював Python-версію'),
  ('diia-osvita (node)',          'node', 'html',   false, 1, '{"module": "diia-osvita"}',                  'Вимкнено: дублював Python-версію'),
  ('easy-gov (node)',             'node', 'api',    false, 1, '{"module": "easy-gov"}',                     'Вимкнено: дублював Python-версію'),
  -- Discovery-агент (щодня 05:00 UTC)
  ('discover-agent', 'agent', 'llm_search', true, 3, '{"keywords": 151, "regions": 20}', 'Sonnet + web search, тема×регіон дня, лише draft')
on conflict (name) do nothing;
