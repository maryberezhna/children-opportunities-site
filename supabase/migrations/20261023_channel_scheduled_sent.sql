-- Замок для запланованих дописів у канал (lib/channel-schedule.js, 23.10.2026).
-- key — первинний ключ: вставка вдається лише раз, тож cron Vercel не надішле
-- той самий допис двічі, навіть якщо прийде двічі. Службова таблиця: RLS
-- увімкнено без політик — читає й пише лише сервісний ключ.
create table if not exists channel_scheduled_sent (
  key text primary key,
  sent_at timestamptz not null default now(),
  message_id bigint
);
alter table channel_scheduled_sent enable row level security;
