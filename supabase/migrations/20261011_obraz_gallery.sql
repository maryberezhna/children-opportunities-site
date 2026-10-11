-- Челендж «Намалюй свій образ» і галерея дитячих малюнків (11.10.2026).
-- Пише й читає лише сервер сервісним ключем (lib/obraz-server.js): RLS
-- увімкнено без жодної політики, тож анонімний ключ таблиці не бачить —
-- email батьків нікуди не витече. Галерею сайт малює на сервері.
create table if not exists public.obraz_entries (
  id uuid primary key default gen_random_uuid(),
  -- Коротка адреса сторінки малюнка: /obraz/r/<public_id>.
  public_id text not null unique check (public_id ~ '^[0-9a-f]{10}$'),
  -- Секрет для батьків: сертифікат і «прибрати малюнок» з листа.
  token text not null unique check (token ~ '^[0-9a-f]{32}$'),
  theme text not null,
  child_name text not null,
  age smallint not null check (age between 6 and 17),
  title text not null,
  story text,
  parent_email text not null,
  consent_at timestamptz not null default now(),
  consent_instagram boolean not null default false,
  image_path text not null,
  -- pending — чекає на Марію; approved — у галереї; rejected — не підійшло;
  -- removed — батьки прибрали самі.
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'removed')),
  award text,
  source text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  removed_at timestamptz,
  mail_sent_at timestamptz
);

create index if not exists obraz_entries_status_idx on public.obraz_entries (status, created_at desc);
create index if not exists obraz_entries_email_idx on public.obraz_entries (parent_email, created_at desc);

alter table public.obraz_entries enable row level security;

-- Малюнки — у публічному бакеті під випадковими іменами: показати можна лише
-- те, чию адресу сайт віддав сам. Список файлів анонімам недоступний (немає
-- політики select на storage.objects), вантажить лише сервер.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('obraz', 'obraz', true, 3145728, array['image/jpeg'])
on conflict (id) do nothing;
