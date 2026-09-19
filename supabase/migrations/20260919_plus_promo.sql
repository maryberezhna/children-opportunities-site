-- Промокоди Dityam+ (рішення Марії 19.09.2026).
-- Знижка застосовується ДО створення інвойса у WayForPay: людина вводить код
-- у боті й одразу бачить нову ціну на кнопці оплати.
-- Код `first`: перший місяць 1 грн замість 99, перший рік 499 замість 999.
-- Знижка діє лише на ПЕРШИЙ платіж — поновлення завжди за повною ціною.

create table if not exists plus_promo_codes (
  code          text primary key check (code ~ '^[a-z0-9-]{2,24}$'),
  first_amount  numeric(10,2) not null check (first_amount > 0),  -- перший місяць
  yearly_amount numeric(10,2) check (yearly_amount > 0),          -- перший рік; null = на рік не діє
  valid_until   date,                                             -- null = безстроково
  max_uses      int check (max_uses > 0),                         -- null = без ліміту
  note          text,
  created_at    timestamptz not null default now()
);

comment on table plus_promo_codes is 'Промокоди Dityam+: ціна ПЕРШОГО платежу. Регулярні списання лишаються повними.';

-- Рахуємо саме ВВЕДЕННЯ коду, а не лише оплати: інакше не видно, скільки людей
-- код привів, а скільки з них не дійшло до оплати.
create table if not exists plus_promo_uses (
  id                uuid primary key default gen_random_uuid(),
  code              text not null references plus_promo_codes(code) on delete cascade,
  telegram_chat_id  text not null,
  telegram_username text,
  source            text,            -- 'kanal', 'instagram', 'typed' — звідки прийшли
  order_reference   text,
  paid_amount       numeric(10,2),
  paid_at           timestamptz,
  created_at        timestamptz not null default now(),
  unique (code, telegram_chat_id)
);

create index if not exists plus_promo_uses_code_idx on plus_promo_uses (code, created_at desc);

alter table plus_promo_codes enable row level security;
alter table plus_promo_uses  enable row level security;
-- Політик немає навмисно: таблиці читає й пише лише сервер (service role).

alter table digest_subscribers add column if not exists promo_code text;
comment on column digest_subscribers.promo_code is 'Промокод, введений перед оплатою (lib/promo.js).';

insert into plus_promo_codes (code, first_amount, yearly_amount, note)
values ('first', 1, 499, 'Перші користувачі: місяць 1 грн замість 99, рік 499 замість 999 (−50%)')
on conflict (code) do nothing;
