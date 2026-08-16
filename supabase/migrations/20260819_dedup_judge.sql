-- ============================================================================
-- Фаза 3 конвеєра даних: дедуплікація неточних дублів
--
-- Канонічний URL (Фаза 1) ловить точні збіги. Лишились неточні: той самий
-- табір на сайті фонду і в Telegram-каналі — різні URL, різні слова.
--
-- Схема: кандидатів генерує pg_trgm (дешево, працює з кирилицею; поріг
-- свідомо низький — 0.35, бо за вимірами в normalizer.py жоден поріг
-- схожості назв сам по собі не розділяє дублі й різні записи), а РІШЕННЯ
-- ухвалює LLM-суддя (scraper/dedup_judge.py). Кожна пара судиться один раз —
-- вердикт лягає в dedup_judgments і повторно не оплачується.
-- ============================================================================

create extension if not exists pg_trgm;

create index if not exists idx_opp_title_trgm
  on opportunities using gin (title gin_trgm_ops);

create table if not exists dedup_judgments (
  id_a      uuid not null,
  id_b      uuid not null,
  verdict   text not null check (verdict in ('duplicate', 'distinct')),
  sim       real,
  judged_at timestamptz not null default now(),
  primary key (id_a, id_b)
);
alter table dedup_judgments enable row level security;

-- Кандидати: активні пари одного типу зі схожими назвами, ще не суджені.
-- Пари з ОДНАКОВИМ canonical_url не потрапляють: точні дублі вже ловить
-- тригер Фази 1, а хабові сторінки легально ділять URL.
create or replace function find_dup_candidates(
  sim_threshold real default 0.35,
  max_pairs     integer default 30
)
returns table(id_a uuid, id_b uuid, sim real) as $$
  select a.id, b.id, similarity(a.title, b.title) as sim
  from opportunities a
  join opportunities b
    on a.id < b.id
   and a.opportunity_type = b.opportunity_type
   and similarity(a.title, b.title) >= sim_threshold
  where a.status = 'active' and b.status = 'active'
    and a.canonical_url is distinct from b.canonical_url
    and not exists (
      select 1 from dedup_judgments j
      where j.id_a = a.id and j.id_b = b.id
    )
  order by sim desc
  limit max_pairs;
$$ language sql stable;
