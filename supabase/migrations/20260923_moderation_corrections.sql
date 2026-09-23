-- Що саме людина виправила за моделлю (23.09.2026).
--
-- Привід: ми не зберігали, ЩО саме виправила людина. Модератор міняв у
-- /admin/edit тип із «Курс» на «Табір» чи вартість із «Безкоштовно» на
-- «Платно» — і старе значення зникало назавжди, бо update пише поверх.
-- Тому конвеєр повторював ті самі помилки, а правила в промпт доводилось
-- вписувати руками: порахувати, де саме модель систематично хибить, не було
-- з чого.
--
-- Це телеметрія, а не джерело правди. Один рядок = одне змінене поле. Запис
-- іде ПІСЛЯ вдалого збереження й ніколи його не блокує: якщо цієї таблиці ще
-- немає або insert упав, правка людини все одно збережена.
--
-- field = '__decision' — не поле запису, а рішення людини в черзі:
-- before — статус до рішення, after — {action} або {action, comment}, якщо
-- людина написала причину. Пара before→after тоді читається як
-- «чернетка → пропустити»: модель принесла кандидата, людина його не взяла.
create table if not exists moderation_corrections (
  id bigint generated always as identity primary key,
  -- Nullable навмисно: сирець із карантину (raw_items) ще не став можливістю,
  -- тож source='quarantine' колись писатиметься без opportunity_id.
  opportunity_id uuid references opportunities(id) on delete cascade,
  field text not null,
  -- jsonb, а не text: cities — масив, вік — число, рішення — обʼєкт.
  before jsonb,
  after jsonb,
  source text not null check (source in ('edit', 'review', 'quarantine')),
  created_at timestamptz not null default now()
);

-- Два питання звіту: «яке поле найчастіше виправляють» і «що було за тиждень».
create index if not exists moderation_corrections_field_idx
  on moderation_corrections (field);
create index if not exists moderation_corrections_created_idx
  on moderation_corrections (created_at);

-- Лише service_role (адмінка й скрипти): політик для anon немає, як у
-- moderation_notes. Це внутрішня кухня модерації, а не дані для сайту.
alter table moderation_corrections enable row level security;

comment on table moderation_corrections is
  'Виправлення людини за моделлю: одне змінене поле = один рядок. Телеметрія для тюнінгу конвеєра, не джерело правди.';
