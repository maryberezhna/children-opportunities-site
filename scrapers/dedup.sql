-- ============================================================
-- ПРОЦЕС ПЕРЕВІРКИ ТА ОЧИЩЕННЯ ДУБЛІКАТІВ
-- Запускати вручну в Supabase SQL editor або через MCP
-- ============================================================

-- КРОК 1: Знайти дублікати по однаковому source_url
-- (різні назви на одному URL = нормально; однакові назви = дублікат)
SELECT source_url, COUNT(*) as cnt,
       array_agg(slug ORDER BY created_at) as slugs,
       array_agg(LEFT(title, 60) ORDER BY created_at) as titles
FROM opportunities
WHERE status = 'active'
GROUP BY source_url
HAVING COUNT(*) > 1
ORDER BY cnt DESC;

-- КРОК 2: Знайти дублікати по однаковому content_hash
-- (повинно бути 0 — хеш унікальний у DB constraint)
SELECT content_hash, COUNT(*), array_agg(slug)
FROM opportunities
GROUP BY content_hash
HAVING COUNT(*) > 1;

-- КРОК 3: Знайти "тонкі" дублікати — однаковий URL + перші 40 символів назви
-- Повертає ТІЛЬКИ записи для видалення (старіший залишається)
SELECT o.id, o.slug, LEFT(o.title, 60) as title, o.source, o.created_at
FROM opportunities o
WHERE o.status = 'active'
  AND EXISTS (
    SELECT 1 FROM opportunities o2
    WHERE o2.status = 'active'
      AND o2.source_url = o.source_url
      AND LEFT(o2.title, 40) = LEFT(o.title, 40)
      AND o2.id != o.id
      AND o2.created_at < o.created_at
  )
ORDER BY o.source_url, o.created_at;

-- КРОК 4: Закрити дублікати (замінити ids зі Кроку 3)
-- status CHECK constraint: 'active' | 'closed' | 'draft'
-- Використовуємо 'closed' для дублікатів (не 'archived' — не дозволено)
UPDATE opportunities
SET status = 'closed'
WHERE id IN (
  -- вставити id зі Кроку 3
  -- 'uuid-1',
  -- 'uuid-2'
)
RETURNING slug, title, status;

-- КРОК 5: Перевірити скрейпери на однакові source_url
-- Якщо скрейпер і ручний запис вказують на той самий URL з іншою назвою → OK
-- Якщо скрейпер генерує той самий URL + схожу назву → оновити normalizer.mjs
-- content_hash = sha256(title + source_url) → різні назви = різні хеші
-- щоб гарантовано уникнути колізій, в source_url додавай #anchor або ?param

-- КРОК 6: Фінальна статистика
SELECT status, COUNT(*) FROM opportunities GROUP BY status ORDER BY count DESC;

-- ============================================================
-- ПРАВИЛА ДЕДУПЛІКАЦІЇ ДЛЯ СКРЕЙПЕРІВ
-- ============================================================
-- 1. content_hash = sha256(title + source_url) — первинний ключ дедупу
--    Якщо заголовок змінився (нова версія конкурсу) → новий запис автоматично
-- 2. source_url для статичних скрейперів (МОН, EGAP):
--    Додавай #subject-anchor для унікальності всередині одного URL
--    Приклад: mon.gov.ua/.../olimpiadi#matematyka
-- 3. applyRules() в run.mjs деплює по source_url — якщо два скрейпери
--    повертають однаковий source_url, другий пропускається (seenUrls Set)
-- 4. Після кожного великого додавання — запускати Кроки 1-3 цього скрипту
-- ============================================================
