-- Список очікування онлайн-олімпіади: email тих, кому цікаво, поки продаж
-- закритий (Марія, 06.10.2026: «відкрий сторінку і починай збирати імейли
-- кому цікаво»). На старті кожному — 1 лист; notified_at — щоб не двічі.
-- Лише сервер (сервісний ключ): RLS увімкнено, політик немає.
create table if not exists public.olimpiada_waitlist (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  olimp text not null,
  email text not null,
  source text,
  consent_at timestamptz not null,
  notified_at timestamptz
);

create unique index if not exists olimpiada_waitlist_olimp_email
  on public.olimpiada_waitlist (olimp, lower(email));

alter table public.olimpiada_waitlist enable row level security;
revoke all on public.olimpiada_waitlist from anon, authenticated;
