-- Журнал оплат (Марія, 08.10.2026: «мені треба своя сторінка в адмінці, щоб
-- бачити, хто і скільки разів щось купував»). До цього в базі був лише
-- поточний стан людини (digest_subscribers, olimpiada_entries), а кожне
-- окреме списання бачив тільки кабінет WayForPay.
--
-- Рядок = одна успішна оплата. tx_key робить запис ідемпотентним: WayForPay
-- повторює колбек, а звірка на сторінці може побачити ту саму оплату вдруге.
-- Доступ — лише сервісний ключ (RLS без політик).
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  tx_key text not null unique,
  order_reference text not null,
  -- plus_monthly | plus_halfyear | plus_yearly | olimp_entry | olimp_print
  product text not null,
  amount numeric(10, 2) not null,
  currency text not null default 'UAH',
  paid_at timestamptz not null default now(),
  telegram_chat_id text,
  telegram_handle text,
  email text,
  name text,
  subscriber_id uuid,
  olimp_token text,
  -- callback | check_status | backfill
  source text not null default 'callback',
  created_at timestamptz not null default now()
);

create index if not exists payments_paid_at_idx on public.payments (paid_at desc);
create index if not exists payments_chat_idx on public.payments (telegram_chat_id);
create index if not exists payments_email_idx on public.payments (lower(email));

alter table public.payments enable row level security;
