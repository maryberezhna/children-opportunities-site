-- Звідки прийшла подія (06.10.2026). Марія: «чітко трекай статистику на цій
-- сторінці» — для /olimpiada мало знати «скільки відкрили», треба й «звідки»:
-- з головної, з «Топ 3», з попапу на фільтрі, з Google чи з Telegram.
--
-- source — коротка мітка без даних людини: шлях нашої сторінки (/, /olimpiady),
-- домен чужого сайту (google.com), utm:<джерело> чи місце попапу (home, city).
--
-- Разом із цим застосовано й 20260929_site_events.sql: таблиці в базі не
-- було з 29.09.2026, і /api/event мовчки нічого не записував — верхні кроки
-- воронки Dityam+ (visit, plus_view, plus_click) в адмінці весь час були 0.
alter table site_events add column if not exists source text;
alter table site_events drop constraint if exists site_events_source_len;
alter table site_events add constraint site_events_source_len check (source is null or char_length(source) <= 60);
revoke all on site_events from anon, authenticated;
comment on column site_events.source is 'Звідки: для olimp_view — сторінка чи сайт, з якого прийшли (/, /olimpiady, google.com, utm:...); для olimp_popup_* — де показано (home, city). Жодних даних людини.';
