-- Коментарі людини з модерації — окремо від технічних позначок конвеєра.
--
-- До 22.09.2026 коментар із картки черги перезаписував
-- opportunities.admin_comment — те саме поле, куди конвеєр складає свої
-- позначки («auto: …», «lifecycle …»). Людське губилося серед машинного,
-- а машинне — під людським, і ніхто коментарі окремо не читав.
--
-- action = 'comment' — питання чи прохання без рішення: відкрите
-- (resolved_at is null), доки хтось не обробить, і тоді resolution каже, що
-- зроблено. Коментар до рішення (approve / skip / verify / remove) — лише
-- причина, пишеться одразу закритим.
create table if not exists moderation_notes (
  id bigint generated always as identity primary key,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  action text not null default 'comment'
    check (action in ('comment', 'approve', 'skip', 'verify', 'remove')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution text
);

create index if not exists moderation_notes_open_idx
  on moderation_notes (created_at) where resolved_at is null;
create index if not exists moderation_notes_opportunity_idx
  on moderation_notes (opportunity_id);

-- Лише service_role (адмінка й скрипти): політик для anon немає.
alter table moderation_notes enable row level security;
