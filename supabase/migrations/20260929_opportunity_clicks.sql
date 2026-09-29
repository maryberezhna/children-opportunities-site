-- Переходи до організатора зі сторінки можливості (29.09.2026). GA4 рахує
-- opportunity_click лише назвою, без типу й id, і не бачить тих, хто блокує
-- аналітику. Щоб через місяць сказати гуртку «N родин перейшли на ваш запис»,
-- рахуємо самі: запис, яка кнопка, коли. Жодних даних людини.
create table if not exists opportunity_clicks (
  id bigserial primary key,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  place text not null,
  created_at timestamptz not null default now()
);
create index if not exists opportunity_clicks_opp_time on opportunity_clicks (opportunity_id, created_at);
-- Пише лише /api/click через service role; anon не читає й не пише.
alter table opportunity_clicks enable row level security;
comment on table opportunity_clicks is 'Переходи до організатора зі сторінки можливості: detail_page (офіційний сайт), detail_page_apply (запис/подача), detail_page_bar (панель на телефоні).';
