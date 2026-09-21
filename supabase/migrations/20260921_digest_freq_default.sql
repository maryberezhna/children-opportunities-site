-- Частоту «⚡ Щойно зʼявиться» (instant) прибрано 21.09.2026 (PR #399, рішення Марії:
-- «зупини і видали поки»): добірка насправді йшла раз на день. Код читає instant як
-- «раз на 2 дні»; тут те саме в даних і в значенні за замовчуванням.
-- CHECK свідомо не звужуємо: старий клієнт, що ще надішле instant, не має ламати підписку.
-- Застосовано в проді 21.09.2026 через конектор Supabase (digest_freq_default_2days).
alter table public.digest_subscribers alter column digest_freq set default '2days';
update public.digest_subscribers set digest_freq = '2days' where digest_freq = 'instant';
