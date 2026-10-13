-- «Модний код»: тест можна проходити скільки завгодно разів (Марія, 13.10.2026:
-- «та і взагалі можна скільки хочеш разів»). attempts — номер поточної спроби;
-- на обкладинці лишається кращий результат: best_score / best_missed — найкраща
-- з попередніх спроб, last_score — бали саме останньої.
alter table public.mk_entries
  add column if not exists attempts smallint not null default 1,
  add column if not exists best_score smallint,
  add column if not exists best_missed jsonb,
  add column if not exists last_score smallint;
