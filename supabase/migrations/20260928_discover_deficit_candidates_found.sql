-- 28.09.2026: у проді таблицю discover_deficit_runs створили з колонкою
-- `candidates`, а код (scraper/deficit.py, scripts/morning-brief.mjs) читає й
-- пише `candidates_found`, як у 20260923_discover_deficit.sql. Кожне читання
-- падало («column candidates_found does not exist»), кожен запис — PGRST204,
-- тож памʼяті прогонів не було, штраф за марні спроби не діяв, і розвідник
-- 24–28.09 знову й знову брав «конкурси для дітей 0–3 років».
-- Таблиця була порожня. Застосовано через конектор Supabase 28.09.2026.

ALTER TABLE discover_deficit_runs RENAME COLUMN candidates TO candidates_found;
ALTER TABLE discover_deficit_runs ALTER COLUMN candidates_found SET DEFAULT 0;
UPDATE discover_deficit_runs SET candidates_found = 0 WHERE candidates_found IS NULL;
ALTER TABLE discover_deficit_runs ALTER COLUMN candidates_found SET NOT NULL;
NOTIFY pgrst, 'reload schema';
