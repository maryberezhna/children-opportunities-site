-- Ритм планової перевірки «як у пошуковика» (Марія, 21.09.2026: «якщо джерело
-- оновлюється — перевіряти частіше, а якщо ні — рідше»). scraper/lifecycle.py:
--   page_hash           — відбиток тексту сторінки, на якому остання перевірка
--                         сказала «постійний і відкритий». Той самий текст
--                         наступного разу — модель не кличемо.
--   check_interval_days — поточний інтервал: сторінка змінилась → ÷2 (не менше
--                         7 днів), та сама → ×2 (не більше 90) — «до тижня
--                         найчастіше і раз в 3 місяці найдовше».
-- Застосовано в проді 21.09.2026 через конектор Supabase (adaptive_recheck).
alter table public.opportunities add column if not exists page_hash text;
alter table public.opportunities add column if not exists check_interval_days integer
  check (check_interval_days is null or check_interval_days between 1 and 366);
