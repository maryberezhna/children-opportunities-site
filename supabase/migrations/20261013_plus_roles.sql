-- Хто заповнює анкету Dityam+ (Марія, 13.10.2026): мама/тато, опікун, вчитель,
-- підліток 14–17. Порожньо — старі підписники (вважаємо батьками).
alter table public.digest_subscribers
  add column if not exists role text check (role in ('parent', 'guardian', 'teacher', 'teen')),
  -- Підліток підтвердив кнопкою, що батьки знають і погоджуються (/terms, розділ 1).
  add column if not exists parent_consent_at timestamptz,
  -- Запрошення стати амбасадором після 3 місяців підписки — один раз.
  add column if not exists ambassador_invited_at timestamptz;
