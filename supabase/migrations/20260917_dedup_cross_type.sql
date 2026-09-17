-- Кандидати в дублі й серед РІЗНИХ типів, коли назви дуже схожі — 17.09.2026.
--
-- «Malmö 2026 — Регіональна сесія ЄМП Швеції» лежала в базі двічі: з каналу
-- «Твій космос можливостей» як exchange і з «Можливостей» як conference.
-- Назви майже однакові, але find_dup_candidates брав лише пари ОДНОГО типу,
-- тож суддя цю пару не побачив ніколи. Тип ставить модель, і для того самого
-- оголошення з двох джерел вона легко ставить різний.
--
-- Поріг для різних типів вищий (0.6), ніж для однакових (0.35): інакше
-- «Програмування» і «Програмування на С++» полізли б судді сотнями. На день
-- правки таких пар — 7, частина з них справжні дублі (ENGin, підготовка до ЗНО).
-- Рішення, як і раніше, ухвалює LLM-суддя.
create or replace function find_dup_candidates(
  sim_threshold real default 0.35,
  max_pairs     integer default 30
)
returns table(id_a uuid, id_b uuid, sim real) as $$
  select a.id, b.id, similarity(a.title, b.title) as sim
  from opportunities a
  join opportunities b
    on a.id < b.id
   and similarity(a.title, b.title) >= sim_threshold
   and (a.opportunity_type = b.opportunity_type
        or similarity(a.title, b.title) >= 0.6)
  where a.status = 'active' and b.status = 'active'
    and a.canonical_url is distinct from b.canonical_url
    and not exists (
      select 1 from dedup_judgments j
      where j.id_a = a.id and j.id_b = b.id
    )
  order by sim desc
  limit max_pairs;
$$ language sql stable;
