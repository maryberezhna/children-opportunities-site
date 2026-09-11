-- Кандидати в джерела від щоденного агента-розвідника.
--
-- Навіщо. Досі наповнення було пасивним: ми чекали, поки можливість зʼявиться
-- там, куди ми вже ходимо. Дефіцит найгостріший саме там, де для родини
-- найбільша цінність — можливості для українських дітей за кордоном: фонди,
-- міжнародні організації, стипендійні програми.
--
-- Агент шукає НЕ можливості, а джерела. Для кожного кандидата він пробує
-- сторінку, оцінює її за рубрикою і складає сюди. У каталог звідси не
-- потрапляє нічого: джерело заводить модератор, свідомо.
--
-- Застосовано до живої бази 11.09.2026.

CREATE TABLE IF NOT EXISTS source_candidates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain        text NOT NULL UNIQUE,
  url           text NOT NULL,
  name          text NOT NULL,
  kind          text,
  language      text,
  countries     text[],
  score         smallint NOT NULL DEFAULT 0,
  score_reason  text,
  probe_status  text,
  scrapable     text NOT NULL DEFAULT 'unknown',
  sample        jsonb,
  found_by      text,
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','approved','rejected','duplicate')),
  admin_comment text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  decided_at    timestamptz
);

CREATE INDEX IF NOT EXISTS source_candidates_status_score_idx
  ON source_candidates (status, score DESC);

ALTER TABLE source_candidates ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE source_candidates IS
  'Кандидати в джерела від щоденного агента-розвідника. Акцент — можливості для українських дітей за кордоном: фонди, міжнародні організації. Нічого звідси не потрапляє в каталог автоматично: модератор вирішує, чи заводити джерело.';
COMMENT ON COLUMN source_candidates.scrapable IS
  'yes — сторінка-перелік читається; manual — сайт цінний, але машинного переліку немає, дивитись руками; no — сторінка недоступна; unknown — не перевіряли.';
COMMENT ON COLUMN source_candidates.score IS
  '0-100 за рубрикою: скільки там саме можливостей для дітей 0-18, чи це першоджерело, чи оновлюється, чи доступне українським родинам.';
