-- ============================================================================
-- Фаза 4 конвеєра даних: адаптивний розклад × сезонність × категорії джерел
--
-- 1. Кожне джерело отримує теги категорій — ті самі 8 груп, що на /kategorii
--    (osvita, tabory, finansy, mizhnarodni, konkursy, volonterstvo, kariera,
--    talanty). Це відповідь на «організувати скрапери по категоріях»:
--    видно, яка категорія чим живиться і де покриття тонке.
-- 2. Адаптивний інтервал: джерело без нових знахідок сповільнюється (×2,
--    до 30 днів), джерело зі змінами прискорюється (÷2, до 1 дня).
--    Соцмережі/RSS/агент закріплені на щоденному інтервалі (pin_interval):
--    пости зникають зі стрічки — розтягувати їх не можна.
-- 3. Сезонний множник по категоріях (category_seasons): у сезон інтервал
--    ділиться на множник — табори навесні скрапляться втричі частіше.
--    Календар відомий наперед, тож це конфіг-таблиця, а не ML.
-- ============================================================================

alter table sources add column if not exists categories text[] not null default '{}';
alter table sources add column if not exists crawl_interval_days integer not null default 1;
alter table sources add column if not exists next_crawl_at timestamptz not null default now();
alter table sources add column if not exists pin_interval boolean not null default false;

create table if not exists category_seasons (
  category   text not null,
  month      smallint not null check (month between 1 and 12),
  multiplier real not null default 1,
  primary key (category, month)
);
alter table category_seasons enable row level security;

-- Сезони: >1 — частіше в сезон, <1 — рідше поза ним.
insert into category_seasons (category, month, multiplier) values
  -- Табори: набори відкриваються навесні (лют–тра ×3), восени–взимку тихо.
  ('tabory', 2, 3), ('tabory', 3, 3), ('tabory', 4, 3), ('tabory', 5, 3),
  ('tabory', 9, 0.5), ('tabory', 10, 0.5), ('tabory', 11, 0.5),
  ('tabory', 12, 0.5), ('tabory', 1, 0.5),
  -- Конкурси й олімпіади: старт навчального року (вер–лис ×3), етапи (гру–бер ×2).
  ('konkursy', 9, 3), ('konkursy', 10, 3), ('konkursy', 11, 3),
  ('konkursy', 12, 2), ('konkursy', 1, 2), ('konkursy', 2, 2), ('konkursy', 3, 2),
  ('konkursy', 6, 0.5), ('konkursy', 7, 0.5), ('konkursy', 8, 0.5),
  -- Освіта: набори на навчальний рік (сер–вер ×2).
  ('osvita', 8, 2), ('osvita', 9, 2),
  -- Міжнародні (FLEX, обміни): осінні дедлайни (вер–лис ×2).
  ('mizhnarodni', 9, 2), ('mizhnarodni', 10, 2), ('mizhnarodni', 11, 2)
on conflict do nothing;

-- Соцмережі, RSS і discovery-агент — завжди щоденні.
update sources set pin_interval = true
  where adapter in ('telegram', 'instagram', 'facebook', 'rss', 'llm_search');

-- Теги категорій джерел (8 слагів /kategorii).
update sources set categories = '{konkursy,osvita}'       where name in ('MAN', 'МОН олімпіади', 'mon-subject-olympiads (node)', 'man-contests (node)');
update sources set categories = '{osvita}'                where name in ('Prometheus', 'regional-language-schools', 'egap-stem');
update sources set categories = '{osvita,kariera}'        where name in ('Дія.Освіта', 'diia-osvita (node)');
update sources set categories = '{finansy,osvita}'        where name in ('easy.gov.ua', 'easy-gov (node)');
update sources set categories = '{mizhnarodni}'           where name in ('Erasmus+ UA', 'eurodesk');
update sources set categories = '{mizhnarodni,talanty}'   where name = 'House of Europe';
update sources set categories = '{osvita,konkursy,mizhnarodni}' where name = 'RSS-стрічки';
update sources set categories = '{volonterstvo}'          where name = 'UNICEF';
update sources set categories = '{finansy}'               where name = 'Save the Children';
update sources set categories = '{osvita,mizhnarodni}'    where name = 'British Council';
update sources set categories = '{osvita,konkursy,tabory,mizhnarodni}' where name in ('Telegram (веб)', 'Telegram канали');
update sources set categories = '{talanty,tabory}'        where name = 'Instagram';
update sources set categories = '{osvita,tabory}'         where name = 'Facebook';
update sources set categories = '{talanty}'               where name = 'acmodasi';
update sources set categories = '{talanty,konkursy}'      where name in ('fest-portal', 'constellation-ua');
update sources set categories = '{tabory}'                where name = 'regional-camps';
update sources set categories = '{mizhnarodni,konkursy}'  where name = 'international-competitions';
update sources set categories = '{finansy,talanty}'       where name = 'ucf-grants';
update sources set categories = '{osvita,tabory,finansy,mizhnarodni,konkursy,volonterstvo,kariera,talanty}' where name = 'discover-agent';
