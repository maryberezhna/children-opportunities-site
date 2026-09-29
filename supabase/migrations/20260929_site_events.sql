-- Воронка від сайту до оплати (29.09.2026). Верхні кроки — «зайшов на сайт»,
-- «відкрив сторінку Dityam+», «натиснув у бота» — досі жили лише в GA4, тож в
-- адмінці воронка починалась аж із бота і не відповідала на головне питання:
-- де саме з двох тисяч відвідувачів лишаються одиниці.
--
-- Рахуємо самі з тих самих причин, що й opportunity_clicks: GA4 не бачить
-- тих, хто блокує аналітику, і його числа не дістати з коду сайту.
-- Жодних даних людини: лише назва кроку й час.
create table if not exists site_events (
  id bigserial primary key,
  name text not null,
  created_at timestamptz not null default now()
);
create index if not exists site_events_name_time on site_events (name, created_at);

-- Пише лише /api/event через service role; anon не читає й не пише.
alter table site_events enable row level security;
comment on table site_events is 'Кроки воронки на сайті: visit (сесія), plus_view (сторінка Dityam+), plus_click (перехід у бота).';
