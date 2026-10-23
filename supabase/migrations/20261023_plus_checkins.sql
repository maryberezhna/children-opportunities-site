-- «Чи вдалося на щось подати заявку?» — загальне питання від @DityamPlusBot
-- (Марія, 23.10.2026: «зроби так щоб дітям сам залежно від активності
-- користування питав у користувача фідбек чи вдалося на щось податися»).
--
-- На відміну від plus_applications, тут немає конкретної можливості: питаємо
-- про досвід загалом. Шле scraper/ask_checkin.py, відповідь приймає
-- app/api/telegram/plus/route.js. Доступ лише через service role (RLS без
-- політик), як і решта таблиць Dityam+.
create table if not exists public.plus_checkins (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.digest_subscribers(id) on delete cascade,
  kind text not null check (kind in ('active', 'quiet')),
  asked_at timestamptz not null default now(),
  answer text check (answer is null or answer in ('applied', 'preparing', 'nothing_fit', 'not_looked')),
  answered_at timestamptz,
  -- null — тексту не просили або ще чекаємо; '' — відповіли без тексту.
  note text
);

create index if not exists plus_checkins_subscriber_asked_idx
  on public.plus_checkins (subscriber_id, asked_at desc);

alter table public.plus_checkins enable row level security;
