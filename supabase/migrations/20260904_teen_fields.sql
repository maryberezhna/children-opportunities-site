-- Режим «Підліткам» на головній: картка показує «Отримаєш / Треба» замість
-- «Формат / Місто», а фільтр «Що дає» працює по тегах. Заповнюється
-- LLM-розміткою (scraper/backfill_teen.py) для записів із age_to >= 13.
-- Застосовано до prod 04.09.2026 (mcp apply_migration teen_fields).
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS teen_benefit text,
  ADD COLUMN IF NOT EXISTS teen_requirement text,
  ADD COLUMN IF NOT EXISTS teen_tags text[];

COMMENT ON COLUMN opportunities.teen_benefit IS 'Що підліток отримає, коротко (картка, режим Підліткам)';
COMMENT ON COLUMN opportunities.teen_requirement IS 'Що треба для участі, коротко (картка, режим Підліткам)';
COMMENT ON COLUMN opportunities.teen_tags IS 'Теги фільтра «Що дає»: без досвіду | гроші | поїздка | досвід | сертифікат';
