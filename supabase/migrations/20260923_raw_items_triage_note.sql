-- Карантин: слід машинного розбору + дозволений код «не для дітей».
-- 23.09.2026, разом зі scraper/triage_quarantine.py.
--
-- 1. triage_note. Пакетний розбір карантину (97 записів на 23.09) вирішує за
--    правилами Марії і має лишати по собі причину й ЦИТАТУ з тексту, на якій
--    стоїть рішення. Писати це в last_error не можна: там лежить причина, з
--    якої запис узагалі потрапив у карантин («низька впевненість моделі
--    (0.3)»), і затерти її — втратити половину історії запису. Колонка
--    заповнюється лише на accept/reject; запис, лишений людині, не чіпають
--    узагалі. Скрипт не падає, якщо колонки ще немає (див. write_verdict).
--
-- 2. reject_reason = 'not_for_kids'. Передфільтр у main.py (тендер чи вакансія
--    в заголовку, 21.09.2026) пише саме цей код, а в CHECK від 20.09 його
--    немає: update падає на constraint, raw_store.mark() ловить помилку в лог,
--    і запис лишається pending — щоб завтра знову впертись у той самий
--    передфільтр. Код дозволяємо, а не міняємо код у Python: «не для дітей» —
--    чесна окрема причина, і вона потрібна у звітах поруч із not_child.

alter table public.raw_items
  add column if not exists triage_note text;

comment on column public.raw_items.triage_note is
  'Рішення машинного розбору карантину: причина одним реченням + цитата з тексту джерела.';

-- Стрічка значень, яких у списку бути не може, — щоб constraint нижче ліг
-- без помилки на живій базі.
update public.raw_items
set reject_reason = 'unknown'
where reject_reason is not null
  and reject_reason not in ('low_confidence','not_child','not_for_kids','off_topic',
                            'dead_link','upsert_failed','duplicate','unknown');

-- Старий CHECK створювався всередині ADD COLUMN, тож імені ми напевно не
-- знаємо: знімаємо всі перевірки, що згадують reject_reason, і ставимо свою.
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class cl on cl.oid = con.conrelid
    join pg_namespace ns on ns.oid = cl.relnamespace
    where ns.nspname = 'public' and cl.relname = 'raw_items'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) like '%reject_reason%'
  loop
    execute format('alter table public.raw_items drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.raw_items add constraint raw_items_reject_reason_check
  check (reject_reason is null or reject_reason in
    ('low_confidence','not_child','not_for_kids','off_topic',
     'dead_link','upsert_failed','duplicate','unknown'));
