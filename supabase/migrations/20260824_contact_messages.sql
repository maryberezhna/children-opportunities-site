-- Звернення з контактної форми (/contacts). Один вхідний ящик замість
-- розсипаних mailto-посилань: тип звернення обирає користувач, статус веде
-- адмінка (/admin/messages), сповіщення про нове йде в адмін-чат бота.
-- RLS увімкнено без політик: писати/читати може лише service_role (API-роут).
create table if not exists contact_messages (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'other',
  name text,
  contact text,
  message text not null,
  url text,
  page text,
  status text not null default 'new',
  admin_note text,
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  constraint contact_messages_type_chk check (type in
    ('opportunity','error','complaint','partnership','media','other')),
  constraint contact_messages_status_chk check (status in ('new','in_progress','done'))
);

create index if not exists idx_contact_messages_status
  on contact_messages (status, created_at desc);

alter table contact_messages enable row level security;
