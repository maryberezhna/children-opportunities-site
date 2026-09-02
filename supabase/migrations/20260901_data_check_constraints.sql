-- Сітка №4 (застосована до прод-бази 01.09.2026 через MCP; файл — історія).
-- Значення цих колонок пише LLM-екстрактор; без обмежень на рівні БД його
-- творчість накопичується мовчки (format встиг зібрати 66 довільних значень).
-- Тепер невалідна вставка падає голосно в лог конвеєра.
ALTER TABLE opportunities
  ADD CONSTRAINT opportunities_format_enum
  CHECK (format IS NULL OR format IN ('online','offline','hybrid'));

ALTER TABLE opportunities
  ADD CONSTRAINT opportunities_cost_type_enum
  CHECK (cost_type IS NULL OR cost_type IN
    ('free','partially_free','paid_affordable','paid_premium','subsidized'));

ALTER TABLE opportunities
  ADD CONSTRAINT opportunities_status_enum
  CHECK (status IN ('active','closed','draft'));
