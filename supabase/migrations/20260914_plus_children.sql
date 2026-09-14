-- Dityam+: профіль для кожної дитини, а не один на родину.
--
-- Навіщо. До 14.09.2026 анкета жила в самому рядку підписника: один вік, один
-- набір інтересів. Родина з дитиною 6 і підлітком 15 мусила або вибрати
-- когось одного, або позначити обидва віки й обидва набори інтересів — і тоді
-- малюкові приходив би обмін для старшокласників, бо вік і тема збігались
-- «на родину», а не на дитину.
--
-- Що змінюється.
--   plus_children — вік, вподобання, формат і особливі обставини кожної дитини.
--   digest_subscribers.places — де шукати (місто, онлайн, за кордоном). Це
--     спільне для родини: живуть усі в одному місці.
--   digest_subscribers.flow_child_id / flow_mode — яку дитину бот зараз
--     заповнює і чи це повна анкета, чи лише «додати ще одну дитину».
--
-- Імені дитини тут немає свідомо: дітей розрізняємо за порядковим номером.

create table if not exists public.plus_children (
  id            uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.digest_subscribers(id) on delete cascade,
  position      smallint not null check (position between 1 and 6),
  age_bands     text[] not null default '{}',
  likes         text[] not null default '{}',
  formats       text[] not null default '{}',
  needs         text[] not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (subscriber_id, position)
);

create index if not exists plus_children_subscriber_idx
  on public.plus_children (subscriber_id);

-- Як і в digest_subscribers: жодних публічних політик, читає й пише лише
-- сервісний ключ. Особливі обставини дитини — чутливі дані.
alter table public.plus_children enable row level security;

alter table public.digest_subscribers
  add column if not exists places        text[] not null default '{}',
  add column if not exists flow_child_id uuid,
  add column if not exists flow_mode     text;

-- Наявні профілі переносимо першою дитиною, щоб нікому не довелось
-- проходити анкету заново. Старі інтереси розкладаємо на вподобання й формат.
insert into public.plus_children (subscriber_id, position, age_bands, likes, formats)
select
  s.id,
  1,
  s.age_bands,
  array(
    select unnest(s.interests)
    intersect
    select unnest(array['stem', 'arts', 'sport', 'languages', 'soft_skills', 'career'])
  ),
  array_remove(array[
    case when s.interests && array['format', 'nonformal'] then 'clubs' end,
    case when 'camps' = any(s.interests) then 'camps' end,
    case when 'contests' = any(s.interests) then 'contests' end
  ], null)
from public.digest_subscribers s
where coalesce(array_length(s.age_bands, 1), 0) > 0
  and not exists (select 1 from public.plus_children c where c.subscriber_id = s.id);
