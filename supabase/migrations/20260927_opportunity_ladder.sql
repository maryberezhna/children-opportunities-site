-- Наступна сходинка: «після X → Y» (рішення Марії 27.09.2026).
--
-- Навіщо. Dityam+ памʼятає, на що родина подається (plus_applications, кнопка
-- «✍️ подаюсь»), але не знав, що йде ПІСЛЯ цієї програми: база знає програми,
-- а не звʼязки між ними. Тож на питання «чи веде платформа дитину по
-- драбині» чесна відповідь була «поки що ні».
--
-- Хто вирішує. Звʼязок пропонує модель (scraper/ladder_propose.py) лише з
-- наявних записів і з поясненням, а вирішує людина кнопкою в адмін-боті.
-- У добірку йде тільки status='confirmed'. Відхилене не пропонується вдруге:
-- пара (from_id, to_id) унікальна, і скрипт не вставляє наявну.

create table if not exists opportunity_ladder (
  id           uuid primary key default gen_random_uuid(),
  from_id      uuid not null references opportunities(id) on delete cascade,
  to_id        uuid not null references opportunities(id) on delete cascade,
  reason       text,
  status       text not null default 'proposed'
                 check (status in ('proposed', 'confirmed', 'rejected')),
  proposed_by  text not null default 'model',
  model        text,
  asked_at     timestamptz,           -- коли картку надіслано в адмін-бот
  decided_at   timestamptz,
  decided_by   text,                  -- Telegram id того, хто натиснув
  created_at   timestamptz not null default now(),
  unique (from_id, to_id),
  check (from_id <> to_id)
);

-- Добірка шукає підтверджене за програмами, які родина позначила.
create index if not exists opportunity_ladder_from_idx
  on opportunity_ladder (from_id, status);
-- Скрипт шукає ще не надіслані на рішення картки.
create index if not exists opportunity_ladder_pending_idx
  on opportunity_ladder (status, asked_at);

-- Для яких програм модель уже шукала сходинку. Без цього запис, після якого
-- нічого не знайшлося, оплачувався б щодня знову.
create table if not exists opportunity_ladder_checks (
  opportunity_id uuid primary key references opportunities(id) on delete cascade,
  checked_at     timestamptz not null default now(),
  found          int not null default 0,
  model          text
);

-- Яку сходинку якій родині вже показали: одна й та сама підказка не має
-- приходити в кожній добірці.
create table if not exists plus_ladder_sent (
  subscriber_id uuid not null references digest_subscribers(id) on delete cascade,
  ladder_id     uuid not null references opportunity_ladder(id) on delete cascade,
  sent_at       timestamptz not null default now(),
  primary key (subscriber_id, ladder_id)
);

-- Закрито наглухо, як plus_applications: пишуть лише сервіс-роль (скрипти) і
-- вебхук адмін-бота.
alter table opportunity_ladder enable row level security;
alter table opportunity_ladder_checks enable row level security;
alter table plus_ladder_sent enable row level security;
