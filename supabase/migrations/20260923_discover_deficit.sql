-- Памʼять прогонів агента-розвідника за дефіцитом — 23.09.2026.
--
-- Навіщо. З 23.09.2026 розвідник обирає тему не сліпою ротацією слів, а за
-- дефіцитом: попит родин ділимо на надходження нових записів (scraper/deficit.py).
-- Заміряно того ж дня: попит на обміни 687 переглядів за 28 днів, на конкурси
-- 566 — а надходить на тиждень 2,9 обміну й 1,6 конкурсу проти 27,6 гуртків.
--
-- Без памʼяті розрахунок має сліпу пляму: клітинка, де можливостей просто не
-- існує (скажімо, конкурси для дітей 0–3), лишається найдефіцитнішою НАЗАВЖДИ —
-- попит на неї є, надходжень нуль, і агент довбав би її щодня. Ця таблиця й
-- дає той єдиний запобіжник, який ЗНИЖУЄ пріоритет: клітинка, де вже шукали й
-- нічого не дійшло до бази, ділиться на число марних спроб.
--
-- Код без таблиці працює: load_runs() ловить виняток і рахує без штрафу.
-- Застосувати вручну (Claude не має доступу на запис схеми).

CREATE TABLE IF NOT EXISTS discover_deficit_runs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Клітинка: родина типів × віковий діапазон. Міста тут немає свідомо —
  -- вісь пошуку лише вік і тема (Марія, 22.09.2026: «ми не гарантуємо
  -- можливостей саме з міста»).
  family            text NOT NULL,
  age_band          text NOT NULL,
  keyword           text,
  candidates_found  smallint NOT NULL DEFAULT 0,
  saved             smallint NOT NULL DEFAULT 0,
  ran_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS discover_deficit_runs_cell_idx
  ON discover_deficit_runs (family, age_band, ran_at DESC);

ALTER TABLE discover_deficit_runs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE discover_deficit_runs IS
  'Памʼять прогонів агента-розвідника за дефіцитом (з 23.09.2026): де шукали, скільки кандидатів знайшлось і скільки з них дійшло до бази. Потрібна лише для штрафу за марні спроби — без неї розрахунок працює, просто не памʼятає невдач.';
COMMENT ON COLUMN discover_deficit_runs.family IS
  'Родина типів із plus_profile.FORMAT_TYPES: clubs | camps | contests | grants | support | family_aid | volunteering.';
COMMENT ON COLUMN discover_deficit_runs.age_band IS
  'Віковий діапазон із plus_profile.AGE_RANGES: 0-3 | 4-6 | 7-10 | 11-14 | 15-18.';
COMMENT ON COLUMN discover_deficit_runs.candidates_found IS
  'Скільки кандидатів повернув вебпошук — до дедупу й перевірки сторінкою.';
COMMENT ON COLUMN discover_deficit_runs.saved IS
  'Скільки з них справді лягло в базу чернетками. saved = 0 — марна спроба: наступного разу клітинка отримає штраф.';
