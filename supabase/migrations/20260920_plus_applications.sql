-- Памʼять про пройдене: на що родина вже подається.
--
-- Навіщо. Dityam+ обіцяє «памʼятаємо пройдене — пропонуємо наступний крок», а
-- памʼяті не було: opportunity_outcomes — це анонімна форма з сайту («я
-- подався»), без звʼязку з підписником, а opportunity_feedback тримає лише
-- 👍/👎 під карткою. Тож бот міг запропонувати вдруге те, на що родина вже
-- подала заявку.
--
-- Позначку ставить сама людина кнопкою «✍️ Подаємося» під карткою в боті.
-- Нічого не вигадуємо: немає натискання — немає запису.
--
-- Стадії: 'applying' — подаємося (єдина, яку зараз ставить бот); решта —
-- для наступного кроку, коли бот питатиме «як минуло?» після дедлайну.

create table if not exists plus_applications (
  subscriber_id  uuid not null references digest_subscribers(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  stage          text not null default 'applying'
                   check (stage in ('applying', 'applied', 'skipped', 'accepted')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (subscriber_id, opportunity_id)
);

-- Вибірка «що вже позначила ця родина» — для добірки й нагадувань.
create index if not exists plus_applications_sub_idx
  on plus_applications (subscriber_id, stage);

-- Закрито наглухо, як digest_subscribers: пише лише сервіс-роль через бота й крон.
alter table plus_applications enable row level security;
