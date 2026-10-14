-- Другий рукав відбору кандидатів у дублі: той самий дедлайн — 14.10.2026.
--
-- Дубль School of Resilience (картки від 06.10 і 08.10.2026) прожив на сайті
-- 6 ночей: тригамна схожість назв «School of Resilience — програма
-- особистісного розвитку» і «School of Resilience від Klitschko Foundation» —
-- 0.27, нижче порога 0.35. Різні українські хвости розмивають спільну
-- англійську голову, і перший рукав (title % title) пару не бачить. Обидві
-- картки індексувались, показували одна одну в «Схожих можливостях» і вели
-- на різні форми реєстрації.
--
-- У справжніх дублів одноразових програм дедлайн збігається майже завжди,
-- тож рівність дедлайна — сильний спільний сигнал. Додаємо рукав:
-- той самий (ненульовий) дедлайн + word_similarity >= 0.4. word_similarity
-- шукає найкращий збіг ШМАТКА назви, тому спільна голова при різних хвостах
-- її не лякає (у пари вище — 0.47 проти 0.27 у similarity).
--
-- Виміряно на живій базі 14.10.2026: активних незасуджених пар з однаковим
-- дедлайном 66, з них над порогом 0.4 — лише 2. Рукав дешевий і точний.
-- Рішення, як і раніше, ухвалює LLM-суддя: обидва рукави лише пропонують.
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
  select c.cid_a, c.cid_b, c.csim
  from (
    -- Рукав 1: тригамна схожість назв через idx_opp_title_trgm (як було).
    select a.id as cid_a, b.id as cid_b,
           similarity(a.title, b.title)::real as csim
    from opportunities a
    join opportunities b
      on a.id < b.id
     and b.title % a.title
    where a.status = 'active' and b.status = 'active'
      and a.canonical_slug is null and b.canonical_slug is null
      and (a.opportunity_type = b.opportunity_type
           or similarity(a.title, b.title) >= 0.6)
      and a.canonical_url is distinct from b.canonical_url

    union

    -- Рукав 2: той самий дедлайн + схожий шматок назви. Типи можуть
    -- різнитись: у дублів вони теж бувають розкласифіковані по-різному.
    select a.id, b.id, similarity(a.title, b.title)::real
    from opportunities a
    join opportunities b
      on a.id < b.id
     and a.deadline = b.deadline
    where a.status = 'active' and b.status = 'active'
      and a.deadline is not null
      and a.canonical_slug is null and b.canonical_slug is null
      and a.canonical_url is distinct from b.canonical_url
      and greatest(word_similarity(a.title, b.title),
                   word_similarity(b.title, a.title)) >= 0.4
  ) c
  where not exists (
    select 1 from dedup_judgments j
    where j.id_a = c.cid_a and j.id_b = c.cid_b
  )
  order by c.csim desc
  limit max_pairs;
end;
$$;
