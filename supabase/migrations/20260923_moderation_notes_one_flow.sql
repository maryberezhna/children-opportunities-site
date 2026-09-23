-- Один механізм коментарів модератора замість двох (23.09.2026).
--
-- 22.09.2026 дві паралельні сесії зробили два механізми в один день, і вони
-- не бачили один одного:
--   • таблиця moderation_notes — кнопка «💬 Залишити коментар» у /admin,
--     ранкове зведення, картка в черзі;
--   • opportunities.moderation_note + note_status='pending' — кнопка
--     «💬 Нотатка» в адмін-боті, погодинний scraper/process_notes.py.
-- Через це коментарі Марії з адмінки висіли необробленими: скрипт, який уміє
-- їх застосовувати, дивився не туди.
--
-- Джерелом правди лишається moderation_notes: там історія, кілька коментарів
-- на запис і статус обробки. Бот тепер пише теж у неї.

-- Слід спроби застосувати коментар автоматично. resolved_at лишається
-- порожнім (коментар відкритий і чекає людину), але LLM більше не читає його
-- щогодини наново. Окрема колонка, а не resolution: за домовленістю в
-- CLAUDE.md порожній resolution при відкритому рядку означає «питання до
-- Марії», і зайняти його технічною позначкою не можна.
alter table moderation_notes add column if not exists attempted_at timestamptz;

-- Перенесення наявних нотаток зі старого механізму. Idempotent: той самий
-- текст на той самий запис двічі не вставиться, а note_status зі 'pending'
-- стає 'migrated', тож повторний запуск нічого не знайде.
--
-- Беремо ЛИШЕ note_status = 'pending' — це слід людини. У те саме поле
-- audit_seed.py і audit_clubs.py пишуть пояснення, чому сховали запис
-- («лише для дорослих»), і свідомо лишають note_status порожнім: вказівкою
-- редактора це не є, застосовувати його не можна.
insert into moderation_notes (opportunity_id, body, action, created_at)
select o.id,
       left(btrim(o.moderation_note), 2000),
       'comment',
       coalesce(o.updated_at, now())
from opportunities o
where o.note_status = 'pending'
  and btrim(coalesce(o.moderation_note, '')) <> ''
  and not exists (
    select 1 from moderation_notes n
    where n.opportunity_id = o.id
      and n.body = left(btrim(o.moderation_note), 2000)
  );

update opportunities
   set note_status = 'migrated'
 where note_status = 'pending';

-- Колонки moderation_note / note_status лишаються: moderation_note далі
-- пишуть автозвірки (audit_seed.py, audit_clubs.py) як пояснення для людини.
-- Нового коментаря людини туди не потрапляє.
