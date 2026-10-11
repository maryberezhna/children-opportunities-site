-- Записи зі «Звернень» не закриває навіть дедлайн (Марія, 11.10.2026: «якщо це
-- приходить зі звернень, то ніколи не чіпай його при перевірці» → «то не чіпай
-- їх»). Ті самі позначки, що в scraper/requests_guard.py.
CREATE OR REPLACE FUNCTION public.close_expired_opportunities()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
     and coalesce(o.admin_comment, '') not ilike '%💡 пропозиція з форми на сайті%'
     and coalesce(o.admin_comment, '') not ilike '%опубліковано вручну за рішенням Марії%'
     and coalesce(o.admin_comment, '') not ilike '%💡 принесла Марія%'
     and (   o.deadline < today
          or o.event_end_date < today
          or (o.deadline is null and o.event_end_date is null and o.event_start_date < today)
          or (o.deadline is null and o.event_end_date is null and o.event_start_date is null
              and o.results_date < today));
  get diagnostics n = row_count;
  return n;
end;
$function$;
