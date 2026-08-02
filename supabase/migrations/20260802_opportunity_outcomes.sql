-- Кейси родин: «я подався» / «мене взяли» під конкретною можливістю.
-- Навіщо: без цього ми знаємо лише кліки, а не чи довела можливість до результату.
-- Підтверджені кейси — найсильніший аргумент у пітчі для медіа.
--
-- Приватність за задумом (як у digest_subscribers): НІ імені дитини, НІ віку,
-- НІ школи. Максимум — місто (вільний текст, необовʼязково) і контакт, який
-- людина лишає САМА і лише якщо згодна, щоб з нею звʼязались для історії.

create table if not exists opportunity_outcomes (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),

  opportunity_id  uuid not null references opportunities(id) on delete cascade,

  -- 'applied' — подався; 'accepted' — взяли/пройшов
  stage           text not null check (stage in ('applied', 'accepted')),

  -- необовʼязкова коротка історія від родини
  story           text,
  city            text,

  -- контакт лише за явною згодою; порожньо = «не звʼязуйтесь»
  contact         text,
  contact_consent boolean not null default false,

  -- нічого не показуємо публічно без ручної перевірки
  status          text not null default 'pending'
                    check (status in ('pending', 'approved', 'rejected')),
  admin_comment   text
);

create index if not exists opportunity_outcomes_opp_idx
  on opportunity_outcomes (opportunity_id, stage);

create index if not exists opportunity_outcomes_queue_idx
  on opportunity_outcomes (status, created_at desc)
  where status = 'pending';

-- Закрито наглухо: форма пише через API сервіс-роллю, анонімного доступу немає.
alter table opportunity_outcomes enable row level security;
