-- «Щось не так? Повідомити» зі сторінки можливості (редизайн, PR 2,
-- 29.09.2026): повідомлення з сайту йдуть у ту саму opportunity_feedback, що
-- й 👍/👎 із Telegram (рішення Марії 29.09.2026).
--
-- Що заважало. Ключ таблиці був (opportunity_id, telegram_user_id), а
-- telegram_user_id — NOT NULL: у відвідувача сайту Telegram-id немає. І value
-- дозволяв лише 'yes'/'no'.
--
-- Що змінюємо, не ламаючи бота. Ключ стає сурогатним (id), а пара
-- (opportunity_id, telegram_user_id) — звичайним UNIQUE: у Postgres NULL у
-- унікальному обмеженні різні, тож повідомлень із сайту на один запис може
-- бути багато, а голос із Telegram лишається один на людину. Саме звичайне
-- UNIQUE, а не частковий індекс: upsert бота йде через
-- ON CONFLICT (opportunity_id, telegram_user_id) (PostgREST onConflict), і
-- частковий індекс без WHERE у запиті Postgres не підхопив би.

alter table opportunity_feedback drop constraint opportunity_feedback_pkey;
alter table opportunity_feedback add column id bigint generated always as identity primary key;
alter table opportunity_feedback alter column telegram_user_id drop not null;
alter table opportunity_feedback
  add constraint opportunity_feedback_tg_uniq unique (opportunity_id, telegram_user_id);

alter table opportunity_feedback drop constraint opportunity_feedback_value_check;
alter table opportunity_feedback
  add constraint opportunity_feedback_value_check check (value in ('yes', 'no', 'report'));

-- Звідки прийшло: 'telegram' (канал і добірки Dityam+) чи 'site' (кнопка на
-- сторінці). Старі рядки — усі з Telegram.
alter table opportunity_feedback add column source text not null default 'telegram';
alter table opportunity_feedback
  add constraint opportunity_feedback_source_check check (source in ('telegram', 'site'));

-- Slug сторінки, з якої натиснули: щоб у діджесті було, куди дивитись.
alter table opportunity_feedback add column page text;

-- Повідомлення з сайту за період — для тижневого діджесту.
create index if not exists opportunity_feedback_site_idx
  on opportunity_feedback (created_at) where source = 'site';
