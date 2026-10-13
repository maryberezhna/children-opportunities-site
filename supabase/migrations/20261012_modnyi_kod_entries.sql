-- «Модний код» — платна онлайн-олімпіада з моди (12.10.2026, Марія: «публікуй
-- і одразу трекай, скільки зайшло на сторінку і скільки купило»). Окрема
-- таблиця, щоб не змішувати зі статистикою олімпіади з логіки. Пише й читає
-- лише сервер (RLS без політик). Ключі відповідей — у olimpiada_keys
-- (olimp = 'modnyi-kod'), не в репозиторії.
create table if not exists public.mk_entries (
  id uuid primary key default gen_random_uuid(),
  token text not null unique check (token ~ '^[0-9a-f]{32}$'),
  child_name text not null,
  child_age smallint not null check (child_age between 10 and 14),
  designer_word text check (designer_word in ('дизайнер', 'дизайнерка')),
  parent_email text not null,
  consent_at timestamptz not null default now(),
  amount integer not null default 99,
  source text,
  created_at timestamptz not null default now(),
  wfp_order_reference text,
  wfp_last_status text,
  paid_at timestamptz,
  invite_sent_at timestamptz,
  started_at timestamptz,
  question_order jsonb,
  finished_at timestamptz,
  answers jsonb,
  score smallint,
  max_score smallint,
  missed_questions jsonb,
  look jsonb,
  look_title text,
  cover_theme text,
  look_at timestamptz,
  refunded_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists mk_entries_email_idx on public.mk_entries (parent_email, created_at desc);
create index if not exists mk_entries_order_idx on public.mk_entries (wfp_order_reference);
alter table public.mk_entries enable row level security;
