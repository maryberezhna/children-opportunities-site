-- raw_items: зробити відбір вимірюваним і перестати мовчки втрачати рідкісне.
-- Скрипт Марії, застосований 20.09.2026 (чотирма частинами через обрив звʼязку).
--
-- Що було: оцінка класифікатора й причина відмови жили текстом усередині
-- last_error («низька впевненість моделі (0.3)»), тож відбір неможливо було
-- виміряти — ні accept-rate по джерелу, ні місця, де модель вагається.
--
-- Що стало: confidence і reject_reason — колонки; статус review = карантин
-- «не впевнений» окремо від «ні»; дві вʼюхи для розбору й для здоровʼя джерел.
--
-- Код, який це наповнює, — у тому ж PR: normalizer віддає last_confidence і
-- last_reject_code, raw_store.triage_status() кладе сіру смугу 0.25–0.55 у
-- review, ранкове зведення показує чергу.
--
-- Застереження, перевірене на живій базі: у raw_items 137 різних source_name,
-- а в sources — 15 із них. Для решти (канали Telegram, RSS-стрічки) join у
-- вʼюхах дає trust_tier = null, тож сортування там падає на confidence.

alter table public.raw_items
  add column if not exists confidence real
    check (confidence is null or (confidence >= 0 and confidence <= 1)),
  add column if not exists reject_reason text
    check (reject_reason is null or reject_reason in
      ('low_confidence','not_child','off_topic','dead_link',
       'upsert_failed','duplicate','unknown')),
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_verdict text
    check (review_verdict is null or review_verdict in ('accept','reject'));

update public.raw_items
set confidence = substring(last_error from 'впевненість моделі \(([0-9.]+)\)')::real
where confidence is null
  and last_error like 'низька впевненість%'
  and substring(last_error from 'впевненість моделі \(([0-9.]+)\)') is not null;

update public.raw_items
set reject_reason = case
      when last_error like 'низька впевненість%' then 'low_confidence'
      when last_error like 'dead link%'          then 'dead_link'
      when last_error = 'upsert failed'          then 'upsert_failed'
      when last_error like 'duplicate%'          then 'duplicate'
      else 'unknown'
    end
where reject_reason is null and status = 'rejected';

alter table public.raw_items drop constraint if exists raw_items_status_check;
alter table public.raw_items add constraint raw_items_status_check
  check (status in ('pending','processed','review','rejected','failed'));

-- Стейлова помилка там, де запис насправді доїхав до каталогу (32 рядки).
update public.raw_items
set last_error = null
where status = 'processed' and opportunity_id is not null and last_error = 'upsert failed';

update public.raw_items
set status = 'review'
where status = 'rejected' and reject_reason = 'low_confidence'
  and confidence >= 0.25 and confidence < 0.55;

create index if not exists raw_items_review_idx
  on public.raw_items (status, confidence desc) where status = 'review';

create or replace view public.v_raw_review as
select r.id, r.source_name, s.trust_tier, s.adapter, r.confidence, r.raw_title,
       coalesce(r.canonical_url, r.source_url) as url, r.fetched_at,
       now() - r.fetched_at as waiting
from public.raw_items r
left join public.sources s on s.name = r.source_name
where r.status = 'review'
order by s.trust_tier nulls last, r.confidence desc, r.fetched_at;

create or replace view public.v_raw_funnel as
select r.source_name, s.trust_tier, s.adapter, s.enabled,
       count(*) as raw,
       count(*) filter (where r.status = 'processed') as accepted,
       round(100.0 * count(*) filter (where r.status = 'processed')
             / nullif(count(*), 0), 1) as accept_pct,
       count(*) filter (where r.status = 'review') as in_review,
       count(*) filter (where r.status = 'rejected' and r.reject_reason = 'unknown') as silent_rejects,
       round(avg(r.confidence)::numeric, 2) as avg_confidence,
       max(r.fetched_at) as last_item_at
from public.raw_items r
left join public.sources s on s.name = r.source_name
group by r.source_name, s.trust_tier, s.adapter, s.enabled
order by raw desc;
