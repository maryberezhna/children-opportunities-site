-- Педагоги онлайн-олімпіади (Марія, 11.10.2026): «Ви педагог? Хочете
-- залучити дітей до цікавої олімпіади? Отримайте від нас окрему подяку за
-- учнів, які пройдуть олімпіаду за вашим посиланням. Залиште імʼя та email».
--
-- Педагог отримує особисте посилання /olimpiada?vid=<code>; заявка, подана за
-- ним, має olimpiada_entries.teacher_code. Подяка — з першого учня, що пройшов
-- тест; число учнів на ній рахується щоразу заново з olimpiada_entries.
-- thanks_sent_at — лист «перший учень пройшов олімпіаду» вже пішов: його
-- «бронює» один запит (update … where thanks_sent_at is null), тож двоє
-- учнів, що завершили тест в одну мить, не дадуть двох листів.
--
-- Лише сервер (сервісний ключ): RLS увімкнено, політик немає — як у
-- olimpiada_waitlist. Email педагога назовні не віддаємо ніде.
create table if not exists public.olimpiada_teachers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  olimp text not null,
  name text not null,
  email text not null,
  consent_at timestamptz,
  source text,
  created_at timestamptz not null default now(),
  thanks_sent_at timestamptz,
  -- Той самий формат, що й validTeacherCode у lib/olimpiada.js.
  constraint olimpiada_teachers_code_fmt check (code ~ '^[a-km-np-z2-9]{8}$'),
  constraint olimpiada_teachers_name_len check (char_length(name) between 2 and 60)
);

-- Повторна форма з тим самим email повертає той самий код, а не новий рядок.
create unique index if not exists olimpiada_teachers_olimp_email
  on public.olimpiada_teachers (olimp, lower(email));

alter table public.olimpiada_teachers enable row level security;
revoke all on public.olimpiada_teachers from anon, authenticated;

-- Заявка дитини за посиланням педагога. Сайт пише сюди лише код, що є в
-- olimpiada_teachers; зовнішній ключ — другий запобіжник.
alter table public.olimpiada_entries
  add column if not exists teacher_code text references public.olimpiada_teachers (code) on delete set null;

create index if not exists olimpiada_entries_teacher_code
  on public.olimpiada_entries (teacher_code) where teacher_code is not null;

comment on table public.olimpiada_teachers is 'Педагоги онлайн-олімпіади: особисте посилання /olimpiada?vid=<code> і подяка за учнів (з 11.10.2026).';
comment on column public.olimpiada_entries.teacher_code is 'Код педагога, за чиїм посиланням подано заявку (olimpiada_teachers.code).';
