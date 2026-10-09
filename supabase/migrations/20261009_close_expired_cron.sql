-- Прострочене закривається в самій базі, щогодини, за київською датою.
--
-- Досі це робив лише scraper/lifecycle.py (блок A, plan_close) з GitHub
-- Actions. Розклад там 05:10 UTC, але GitHub запускає його на 4–7 годин
-- пізніше: 08.10.2026 прогін пішов о 11:58 UTC. Тож запис із дедлайном
-- «вчора» висів активним до обіду. Марія, 09.10.2026: «у нас не можуть бути
-- прострочені можливості на сайті».
--
-- Ця функція повторює plan_close дослівно: та сама ознака «минуло»
-- (timing.is_expired / lib/timing.js isExpired), status='closed',
-- recheck_at = сьогодні + 2 дні (CONFIRM_AFTER_CLOSE_DAYS: чи не подовжили
-- подачу), той самий слід в admin_comment. lifecycle.py лишається: далі він
-- перечитує сторінки й повертає подовжене.
--
-- Щогодини, а не раз о 00:05: Київ — то UTC+3, то UTC+2, а запит дешевий.

create extension if not exists pg_cron;

create or replace function public.close_expired_opportunities()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'Europe/Kyiv')::date;
  n integer;
begin
  update opportunities o
     set status = 'closed',
         recheck_at = today + 2,
         updated_at = now(),
         admin_comment = left(
           coalesce(nullif(btrim(o.admin_comment), '') || ' · ', '')
           || 'lifecycle: закрито ' || today::text || ' — дата '
           || coalesce(coalesce(o.deadline, o.event_end_date, o.event_start_date, o.results_date)::text, '—')
           || ' минула ('
           || case o.timing_kind when 'one_time' then 'одноразова'
                                 when 'periodic' then 'періодична'
                                 when 'permanent' then 'постійна'
                                 else 'вид невідомий' end
           || '), перевірка ' || (today + 2)::text || ': чи не подовжили',
           500)
   where o.status = 'active'
     and o.canonical_slug is null
     and (   o.deadline < today
          or o.event_end_date < today
          or (o.deadline is null and o.event_end_date is null and o.event_start_date < today)
          or (o.deadline is null and o.event_end_date is null and o.event_start_date is null
              and o.results_date < today));
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.close_expired_opportunities() from public, anon, authenticated;

select cron.schedule('close-expired-opportunities', '5 * * * *',
                     $$select public.close_expired_opportunities()$$);
