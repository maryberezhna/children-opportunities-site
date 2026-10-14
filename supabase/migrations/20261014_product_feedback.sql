-- Відгук одним натиском (Марія, 14.10.2026: «щоб їм було не важко нажати, що
-- сподобалося, а що ні»). Після диплома олімпіади бот питає «Як вам?» —
-- 3 кнопки, потім необовʼязкові теги. Перший натиск зберігається одразу.
create table if not exists public.product_feedback (
  id bigint generated always as identity primary key,
  product text not null,
  entry_token text not null,
  telegram_chat_id text,
  child_name text,
  rating text check (rating in ('good', 'meh', 'bad')),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product, entry_token)
);

-- Читає й пише лише сервер (service role); політик немає навмисно.
alter table public.product_feedback enable row level security;
