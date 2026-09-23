-- ============================================================================
-- «Чим закінчилось»: замикаємо коло навколо позначеної можливості — 23.09.2026
--
-- Марія: «відмічають цікаво — коли можливість пройшла, то зʼявляється питання:
-- ви скористалися цією можливістю? Так чи ні. Якщо так — то розкажіть, як вам.
-- Якщо ні — то чому, і дропдаун з опціями».
--
-- Досі памʼять Dityam+ обривалась на вході: 👍 під карткою і «✍️ Подаємося»
-- писались у базу, а що з того вийшло — не знав ніхто. Тепер @DityamPlusBot
-- питає через три дні після того, як можливість минула, і відповідь лягає
-- сюди ж, у plus_applications.
--
-- Проміжного кроку «Тримаємо кулаки 🤞 Уже є відповідь?» свідомо немає —
-- Марія відхилила його 23.09.2026. Після «Так» одразу просимо розповісти.
--
-- Застосувати руками через конектор Supabase: скрипти міграції не котять.
-- ============================================================================

-- --- Стадії -----------------------------------------------------------------
-- Старий CHECK знімаємо за ВИЗНАЧЕННЯМ, а не за імʼям: ім'я constraint у
-- Postgres згенероване (plus_applications_stage_check) і залежить від того,
-- як саме таблицю створили, а в проді таблицю міг створити не цей файл.
do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'plus_applications'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%stage%'
  loop
    execute format('alter table plus_applications drop constraint %I', c.conname);
  end loop;
end $$;

-- Повний перелік стадій після 23.09.2026:
--   applying — «✍️ Подаємося» під карткою (ставить людина сама);
--   asked    — бот спитав «чи скористалися», відповіді ще немає. Потрібна
--              окремо: 👍 під карткою — це «цікаво», а не «подаємося», і
--              записати такому рядку 'applying' означало б вигадати за людину;
--   used     — «Так, скористалися»;
--   not_used — «Ні»;
--   applied / skipped / accepted — лишаються з 20.09.2026, нічим не займані.
alter table plus_applications
  add constraint plus_applications_stage_check
  check (stage in ('applying', 'asked', 'applied', 'skipped', 'accepted',
                   'used', 'not_used'));

-- --- Відповідь --------------------------------------------------------------
-- asked_at — позначка «про цю можливість цю людину вже питали». Саме вона
-- тримає правило «про одну можливість питаємо рівно один раз»: скрипт ставить
-- її і тим рядкам, про які питати вже пізно (минуло кілька дедлайнів за
-- тиждень — питаємо про найсвіжіший, решту глушимо, щоб не смикати людину
-- заднім числом).
alter table plus_applications add column if not exists asked_at    timestamptz;
alter table plus_applications add column if not exists answered_at timestamptz;
-- reason — код причини з фіксованого списку (lib/plusOutcomes.js), не вільний
-- текст: інакше однакові відповіді неможливо порахувати.
alter table plus_applications add column if not exists reason      text;
-- note — вільний текст людини. NULL = чекаємо на текст (саме за цим бот
-- розуміє, що наступне повідомлення в чаті — відповідь, а не питання в
-- підтримку); '' = людина натиснула «Пропустити» або причина не потребує
-- пояснення.
alter table plus_applications add column if not exists note        text;

comment on column plus_applications.asked_at is
  'Коли бот спитав «чи скористалися». Стоїть і на пропущених — питаємо про можливість рівно раз.';
comment on column plus_applications.answered_at is
  'Коли людина натиснула «Так» або «Ні».';
comment on column plus_applications.reason is
  'Чому не скористались — код зі списку в lib/plusOutcomes.js.';
comment on column plus_applications.note is
  'Вільний текст людини. NULL — чекаємо на нього, '''' — пропустили.';

-- Кандидатів шукаємо за «кого вже питали»: індекс по (subscriber_id, asked_at).
create index if not exists plus_applications_asked_idx
  on plus_applications (subscriber_id, asked_at);
