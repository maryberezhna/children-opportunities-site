-- Звузити доступ публічного (anon) ключа — Марія, 27.09.2026: «так» на
-- «правило доступу в самій базі надто широке».
--
-- Ключ зараз не потрапляє в браузер (перевірено: HTML і всі JS-бандли
-- dityam.com.ua без адреси бази й ключа). Це запобіжник на випадок, якщо
-- колись потрапить: тоді одним запитом читалися б і чернетки з черги
-- модерації, а через дві службові вʼюхи — сирі зібрані дані.

-- 1. opportunities: публічний ключ бачить рівно те, що сайт показує
--    публічно (app/o/shared.js: 'active' і 'closed' — сторінкою,
--    'archived' — переадресацією на головну, щоб старі посилання не давали
--    404). Чернеток ('draft') сайт не показує ніколи — тепер і база їх не
--    віддає. Сайт, адмінка й конвеєр пишуть службовим ключем, тож запис
--    публічному ключу не потрібен.
drop policy if exists "Allow public read access" on public.opportunities;
create policy "Public reads what the site shows"
  on public.opportunities for select to anon, authenticated
  using (status in ('active', 'closed', 'archived'));
revoke insert, update, delete, truncate on public.opportunities from anon, authenticated;

-- 2. Вʼюхи над raw_items були SECURITY DEFINER (перевірка Supabase:
--    security_definer_view, рівень ERROR): виконувались із правами власника й
--    обходили RLS таблиці raw_items. Читає їх лише scripts/morning-brief.mjs
--    службовим ключем.
alter view public.v_raw_funnel set (security_invoker = true);
alter view public.v_raw_review set (security_invoker = true);
revoke all on public.v_raw_funnel, public.v_raw_review from anon, authenticated;
