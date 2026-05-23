-- Додаємо поле cities (масив міст/локацій) до таблиці opportunities
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS cities text[] DEFAULT '{}';

-- Індекс для GIN-пошуку по масиву (для майбутніх запитів на рівні БД)
CREATE INDEX IF NOT EXISTS idx_opportunities_cities ON opportunities USING GIN (cities);

-- Коментар до поля
COMMENT ON COLUMN opportunities.cities IS 'Масив локацій: Онлайн, Київ, Харків, Одеса, Львів, Міжнародні тощо';
