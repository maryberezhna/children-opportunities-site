-- Дублі для «Черги» модерації — 22.09.2026.
--
-- Марія: «це не має перевіряти людина, система має сама показувати можливі
-- дублікати». Досі плашку «Можливий дублікат» на картці кандидата ставив
-- лише discover_agent для своїх знахідок (dup_of при 60 % збігу слів назви).
-- Кандидати з інших шляхів — скрапери, карантин, пропозиції — приходили без
-- перевірки: 22.09.2026 у черзі стояли 23 записи, жоден не мав плашки, і
-- серед них EPAS — слово в слово той самий, що вже активний на сайті.
--
-- Функція для кожної чернетки шукає один найсхожіший активний запис: за
-- канонічним URL (це напевно той самий, sim = 1) або за тригамною схожістю
-- назви через idx_opp_title_trgm, як у find_dup_candidates. Поріг 0.35 — той
-- самий, що в судді дублів: Jeugdfonds Sport & Cultuur у черзі й на сайті
-- збігаються лише на 0.35, але це та сама програма. Хибні збіги на цьому
-- порозі бувають («Центр творчості … Галичини» ↔ «Будинок творчості»), тому
-- плашка каже «порівняй обидва», а не вирішує сама.
--
-- Викликає сторінка /admin (service role) при кожному відкритті: чернеток
-- у черзі десятки, активних ~1100, індексний пошук — частки секунди.
create or replace function find_draft_dups(sim_threshold real default 0.35)
returns table(draft_id uuid, match_slug text, sim real)
language plpgsql
stable
as $$
#variable_conflict use_column
begin
  perform set_limit(sim_threshold);
  return query
  select d.id, m.slug, m.sim
  from opportunities d
  cross join lateral (
    select a.slug,
           (case when d.canonical_url is not null and a.canonical_url = d.canonical_url
                 then 1.0 else similarity(a.title, d.title) end)::real as sim
    from opportunities a
    where a.status = 'active'
      and a.canonical_slug is null
      and (a.title % d.title
           or (d.canonical_url is not null and a.canonical_url = d.canonical_url))
    order by sim desc
    limit 1
  ) m
  where d.status = 'draft';
end;
$$;
