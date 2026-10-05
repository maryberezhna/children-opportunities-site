-- Онлайн-олімпіада Dityam.com.ua (логіка, 9–11 років): записи учасників.
-- Один рядок = одна оплачена участь. Токен — у посиланні на тест і в номері
-- замовлення WayForPay (`olimp-<token>-<ms>`), тому його не вгадати.
-- Читає й пише лише сервер (service role); для anon доступу немає.
create table if not exists public.olimpiada_entries (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  olimp text not null default 'lohika-9-11',
  child_name text not null,
  child_age int,
  parent_email text,
  consent_at timestamptz,
  source text,
  wfp_order_reference text unique,
  amount numeric,
  paid_at timestamptz,
  wfp_last_status text,
  wfp_last_reason text,
  -- unsub_token подарункового рядка digest_subscribers (місяць Dityam+ усім)
  plus_token text,
  started_at timestamptz,
  finished_at timestamptz,
  -- порядок питань і варіантів, який бачила дитина: за ним рахуємо бали
  question_order jsonb,
  answers jsonb,
  score int,
  max_score int,
  level text,
  open_answer text,
  open_answer_at timestamptz,
  -- місяць конкурсу відкритих відповідей за київським часом, напр. 2026-10
  month_key text,
  admin_comment text
);
alter table public.olimpiada_entries enable row level security;
create index if not exists olimpiada_entries_paid_at_idx on public.olimpiada_entries (paid_at);
create index if not exists olimpiada_entries_month_key_idx on public.olimpiada_entries (month_key);

-- Подарунковий місяць Dityam+ за участь в олімпіаді: billing_period = 'gift',
-- gift_until — коли закінчується; gift_notice_at — коли людині про це сказали.
alter table public.digest_subscribers add column if not exists gift_until timestamptz;
alter table public.digest_subscribers add column if not exists gift_notice_at timestamptz;
