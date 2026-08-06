-- Виправлення потоку Dityam+.
--
-- 1. wfp_order_reference — без нього неможливо скасувати рекурентне списання:
--    WayForPay REMOVE приймає саме orderReference. Раніше він нікуди не
--    зберігався, тож /stop зупиняв розсилку, але не гроші.
-- 2. billing_period — щоб MRR не рахував річних підписників по місячній ціні.
-- 3. last_empty_notice_at — щоб не мовчати місяцями, якщо під профіль дитини
--    немає жодної можливості (напр. вік 0-3), і не спамити щодня.

alter table digest_subscribers
  add column if not exists wfp_order_reference text;

alter table digest_subscribers
  add column if not exists billing_period text
    check (billing_period in ('monthly', 'yearly'));

alter table digest_subscribers
  add column if not exists last_empty_notice_at timestamptz;

-- Скасування шукає підписку саме за orderReference з колбека.
create index if not exists digest_subscribers_wfp_order_idx
  on digest_subscribers (wfp_order_reference)
  where wfp_order_reference is not null;
