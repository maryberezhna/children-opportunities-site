-- ============================================================================
-- Щоденні знімки метрик для адмін-сторінки /admin/metrics.
--
-- Лічильники, які можна порахувати з історії таблиць (додані можливості,
-- waitlist), рахуються на льоту — але кількість підписників Telegram-каналу
-- історії не має: Bot API віддає лише поточне число. Тому щоденний знімок
-- (scripts/metrics-snapshot.mjs, cron 20:10 UTC) — з нього ростуть графіки
-- «+N за тиждень» для всього, що інакше було б точкою без минулого.
-- ============================================================================

create table if not exists metrics_daily (
  day                   date primary key,
  telegram_members      integer,
  active_opportunities  integer,
  closed_opportunities  integer,
  draft_opportunities   integer,
  added_today           integer,
  waitlist_total        integer,
  digest_profiles       integer,
  plus_active           integer,
  plus_mrr              integer,
  feedback_votes_total  integer,
  captured_at           timestamptz not null default now()
);

alter table metrics_daily enable row level security;
