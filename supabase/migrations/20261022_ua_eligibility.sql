-- Хто може подати закордонну можливість (Марія, 22.10.2026: «для всіх закордонних можливостей
-- має бути точно вказано, чи може дитина з України подати заявку, якщо ні — чи з діаспори»).
-- from_ukraine — можна подати, живучи в Україні; abroad_only — лише ті, хто живе за кордоном
-- (ua_eligibility_note: де саме); none — ні з України, ні з діаспори без окремого відбору
-- (наприклад, лише громадяни США); unknown — на сторінці не сказано. NULL — ще не перевірено.
-- Застосовано в проді через конектор 22.10.2026.
alter table public.opportunities add column if not exists ua_eligibility text
  check (ua_eligibility is null or ua_eligibility in ('from_ukraine', 'abroad_only', 'none', 'unknown'));
alter table public.opportunities add column if not exists ua_eligibility_note text;
