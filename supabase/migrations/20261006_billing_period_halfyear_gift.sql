-- billing_period у digest_subscribers дозволяв лише monthly і yearly: піврічна
-- підписка (halfyear, з 27.09.2026) і подарунковий місяць за олімпіаду (gift)
-- впирались у CHECK — так 05–06.10.2026 тестові записи олімпіади лишились без
-- Dityam+ (plus_token null). Дозволяємо обидва значення.
alter table public.digest_subscribers drop constraint if exists digest_subscribers_billing_period_check;
alter table public.digest_subscribers add constraint digest_subscribers_billing_period_check
  check (billing_period is null or billing_period = any (array['monthly'::text, 'yearly'::text, 'halfyear'::text, 'gift'::text]));
