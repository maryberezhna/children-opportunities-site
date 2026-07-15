-- Персональна підбірка (Dityam+): платні підписники, що раз на 2 тижні
-- отримують підібрані під дитину можливості в Telegram або на email.
--
-- Приватність за задумом: НІ імені, НІ дати народження, НІ школи дитини —
-- лише вік-діапазон(и) та інтереси. Достатньо для матчингу, безпечно для родини.
-- Таблиця закрита RLS: пишеться/читається лише сервіс-роллю через API та крон.

create table if not exists digest_subscribers (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- канал доставки (батько обирає один)
  channel          text not null check (channel in ('telegram', 'email')),
  email            text,                       -- якщо channel='email'
  telegram_handle  text,                       -- що ввів користувач (@username), для звірки
  telegram_chat_id text,                       -- проставляється, коли він /start-нув бота

  -- профіль дитини — БЕЗ точних даних
  age_bands        text[] not null default '{}',   -- напр. {'0-3','7-10'}
  gender           text not null default 'any' check (gender in ('boy', 'girl', 'any')),
  interests        text[] not null default '{}',   -- ключі 12 тем (stem, arts, sport, …)
  cost_pref        text not null default 'any' check (cost_pref in ('free_only', 'any')),
  region_pref      text,                        -- 'online' | місто | null(=будь-де)

  -- підписка та згода
  plan             text not null default 'free' check (plan in ('free', 'premium')),
  status           text not null default 'pending'
                     check (status in ('pending', 'active', 'paused', 'unsubscribed')),
  consent_at       timestamptz,
  unsub_token      text not null default encode(gen_random_bytes(16), 'hex'),
  last_sent_at     timestamptz
);

-- крон-вибірка активних, кому час слати
create index if not exists digest_subscribers_due_idx
  on digest_subscribers (status, last_sent_at)
  where status = 'active';

create unique index if not exists digest_subscribers_email_uidx
  on digest_subscribers (lower(email)) where email is not null;

create unique index if not exists digest_subscribers_unsub_uidx
  on digest_subscribers (unsub_token);

-- Закрито наглухо: жодного анонімного доступу. Працює лише сервіс-роль.
alter table digest_subscribers enable row level security;
