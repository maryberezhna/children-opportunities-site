-- Журнал дій модерації: хто, що і коли зробив.
--
-- 24.09.2026: адмінку відкриває вже не одна людина — черга чернеток
-- переходить до другого адміністратора. Досі ніде не записувалось, хто саме
-- натиснув «схвалити»: moderation_notes зберігає лише коментарі, а
-- moderation_corrections — лише «пропустити» й «прибрати», і теж без імені.
-- Без цього рядка не існує ні статистики роботи людини, ні відповіді на
-- питання «хто це опублікував».
create table if not exists moderation_actions (
  id bigserial primary key,
  opportunity_id uuid references opportunities(id) on delete set null,
  action text not null,
  actor text not null,
  created_at timestamptz not null default now()
);

create index if not exists moderation_actions_created_idx
  on moderation_actions (created_at desc);
create index if not exists moderation_actions_actor_idx
  on moderation_actions (actor, created_at desc);

-- Пишемо лише з сервера сервісним ключем; анонімному читачеві тут нічого.
alter table moderation_actions enable row level security;
