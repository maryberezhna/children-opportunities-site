-- «Обкладинка місяця» (Марія, 13.10.2026: «давай тут щомісяця визначаємо
-- переможця»; критерій — «бали + образ»: серед найвищих балів місяця журі
-- обирає найкращий образ; приз — титул і публікація обкладинки). winner_month
-- — місяць перемоги 'YYYY-MM' (київський), ставить адмін.
alter table public.mk_entries add column if not exists winner_month text check (winner_month ~ '^\d{4}-\d{2}$');
create index if not exists mk_entries_winner_idx on public.mk_entries (winner_month) where winner_month is not null;
