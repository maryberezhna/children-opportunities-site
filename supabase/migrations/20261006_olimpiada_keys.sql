-- Ключі правильних відповідей олімпіади. Репозиторій сайту публічний, тому
-- відповіді не можуть лежати в коді: банк завдань (content/olimpiada) — без
-- них, а бали рахує сервер за цією таблицею (lib/olimpiada-server.js →
-- loadKeys). answers: { "v01": 3, "v02": 1, ... } — індекс правильного
-- варіанта в масиві options. Лише сервіс: RLS без політик.
create table if not exists public.olimpiada_keys (
  olimp text primary key,
  answers jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.olimpiada_keys enable row level security;

-- Диплом листом батькам після тесту: коли надіслано (той самий скрипт, що
-- й запрошення — scraper/olimpiada_invites.py).
alter table public.olimpiada_entries add column if not exists diploma_sent_at timestamptz;
