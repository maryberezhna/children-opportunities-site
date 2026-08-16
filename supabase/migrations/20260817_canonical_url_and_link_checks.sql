-- ============================================================================
-- Фаза 1 конвеєра даних: канонічний URL + цикл верифікації лінків
--
-- 1. canonical_url — єдиний ключ ідентичності можливості для всіх трьох
--    пайплайнів (Python, Node, discover-агент). Формула: scraper/canonical.py
--    та scrapers/lib/canonical.mjs (дзеркальні).
-- 2. Тригер-захист від дублів при INSERT: новий активний запис із canonical_url,
--    який уже є в іншого активного запису, стає draft із dup_of → потрапляє
--    в наявну чергу модерації замість каталогу. НЕ unique-індекс: хабові
--    сторінки (перелік олімпіад МОН, каталог Дії) легально діляться одним URL —
--    їх перелічує dedup_hub_urls.
-- 3. Колонки циклу верифікації: link_status (ok→suspect→dead), link_failures,
--    link_checked_at, last_verified_at — заповнює scripts/verify-links.mjs.
-- ============================================================================

alter table opportunities add column if not exists canonical_url text;
alter table opportunities add column if not exists link_status text not null default 'ok';
alter table opportunities add column if not exists link_checked_at timestamptz;
alter table opportunities add column if not exists link_failures integer not null default 0;
alter table opportunities add column if not exists last_verified_at timestamptz;

do $$ begin
  alter table opportunities add constraint opportunities_link_status_check
    check (link_status in ('ok', 'suspect', 'dead'));
exception when duplicate_object then null; end $$;

create index if not exists idx_opp_canonical_url
  on opportunities (canonical_url) where canonical_url is not null;

-- Хабові URL: одна адреса — багато справжніх можливостей. Префіксне порівняння.
create table if not exists dedup_hub_urls (
  url_prefix text primary key
);
alter table dedup_hub_urls enable row level security;

insert into dedup_hub_urls (url_prefix) values
  ('https://mon.gov.ua/osvita-2/zagalna-serednya-osvita/olimpiadi-ta-konkursi'),
  ('https://diia.gov.ua/services'),
  ('https://mms.gov.ua'),
  ('https://mincult.gov.ua'),
  ('https://constellation.org.ua'),
  ('https://fest-portal.com/meropriyatiya'),
  ('https://klitschkofoundation.org/projects'),
  ('https://artarsenal.in.ua'),
  ('https://ukraine.uwc.org/apply'),
  ('https://man.gov.ua/contests/olympiad'),
  ('https://osvita.diia.gov.ua/courses')
on conflict do nothing;

-- Захист від дублів між пайплайнами. Спрацьовує лише на INSERT нового активного
-- запису: якщо canonical_url уже зайнятий іншим активним записом (і це не хаб),
-- новий запис стає чернеткою з dup_of (слаг оригіналу, як у discover-агента) —
-- модератор бачить його в черзі поруч з оригіналом і вирішує.
-- Звичайний щоденний re-upsert існуючого запису конфліктить по content_hash
-- і НЕ вставляє новий рядок, тож тригер його не чіпає.
create or replace function opportunities_dedup_guard() returns trigger as $$
declare
  original_slug text;
begin
  if new.canonical_url is null or new.status <> 'active' then
    return new;
  end if;
  if exists (
    select 1 from dedup_hub_urls h
    where new.canonical_url like h.url_prefix || '%'
  ) then
    return new;
  end if;
  select slug into original_slug
  from opportunities
  where canonical_url = new.canonical_url
    and status = 'active'
    and id <> new.id
  limit 1;
  if original_slug is not null then
    new.status := 'draft';
    new.dup_of := original_slug;
    new.dup_score := 1.0;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_opportunities_dedup_guard on opportunities;
create trigger trg_opportunities_dedup_guard
  before insert on opportunities
  for each row execute function opportunities_dedup_guard();
