-- «Щодня» повернуто як варіант частоти добірки Dityam+ — першим і за
-- замовчуванням (Марія, 21.09.2026: «так поки щодня… у Dityam+ кожен сам
-- вибирає як»). Кількома годинами раніше прибрано «⚡ Щойно зʼявиться»
-- (instant, PR #399) і default став '2days' (20260921_digest_freq_default.sql).
-- instant лишається в CHECK: старий клієнт, що його надішле, не має ламати підписку.
-- Єдиний підписник (на паузі) обирав instant, до 21.09 його перевели на 2days —
-- повертаємо найближче до його вибору: daily.
-- Застосовано в проді 21.09.2026 через конектор Supabase (digest_freq_daily).
alter table public.digest_subscribers drop constraint if exists digest_subscribers_digest_freq_check;
alter table public.digest_subscribers add constraint digest_subscribers_digest_freq_check
  check (digest_freq = any (array['daily'::text, '2days'::text, 'weekly'::text, 'instant'::text]));
alter table public.digest_subscribers alter column digest_freq set default 'daily';
update public.digest_subscribers set digest_freq = 'daily'
  where digest_freq in ('instant', '2days') and updated_at < '2026-09-21';
