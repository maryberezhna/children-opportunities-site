-- Пошук кандидатів у дублі через тригамний індекс — 20.09.2026.
--
-- Після міграції 20260917 (пари РІЗНИХ типів) функція перестала вкладатись у
-- statement_timeout PostgREST: умова similarity(a.title, b.title) >= поріг у
-- JOIN індексом не береться, тож планувальник порівнював кожен активний запис
-- із кожним — 10.4 с на 1103 записах при ліміті 8 с.
--
-- Наслідок був мовчазний: виняток 57014 ковтався в dedup_judge.run_sweep,
-- нічний скрап лишався зеленим, а суддя не бачив жодної пари з 17.09 —
-- чотири доби й 49 незасуджених пар.
--
-- Лагодить оператор `%` (title % title): він бере idx_opp_title_trgm, і замість
-- повного перебору виходить один індексний пошук на запис — 1.3 с.
-- Поріг оператора живе в pg_trgm.similarity_threshold, тому функція тепер
-- plpgsql: спершу set_limit(sim_threshold), і лише потім запит. Сам відбір
-- (поріг 0.35 для однакових типів, 0.6 для різних) не змінився.
create or replace function find_dup_candidates(
  sim_threshold real default 0.35,
  max_pairs     integer default 30
)
returns table(id_a uuid, id_b uuid, sim real)
language plpgsql
stable
as $$
begin
  perform set_limit(sim_threshold);
  return query
  select a.id, b.id, similarity(a.title, b.title)::real as sim
  from opportunities a
  join opportunities b
    on a.id < b.id
   and b.title % a.title
  where a.status = 'active' and b.status = 'active'
    -- Дублі, вже зведені до оригіналу, повторно судити нема чого.
    and a.canonical_slug is null and b.canonical_slug is null
    and (a.opportunity_type = b.opportunity_type
         or similarity(a.title, b.title) >= 0.6)
    and a.canonical_url is distinct from b.canonical_url
    and not exists (
      select 1 from dedup_judgments j
      where j.id_a = a.id and j.id_b = b.id
    )
  order by sim desc
  limit max_pairs;
end;
$$;
