-- Dityam+ безкоштовний з 21.10.2026 (#982): бот вмикає підписку з billing_period = 'free',
-- але CHECK знав лише monthly/yearly/halfyear/gift — PATCH падав з 400, і всі, хто пройшов
-- анкету 21.10, лишались pending (15 людей за день, бот при цьому писав «увімкнено»).
-- Дозволяємо 'free'. Застосовано в проді через конектор 21.10.2026.
alter table public.digest_subscribers drop constraint if exists digest_subscribers_billing_period_check;
alter table public.digest_subscribers add constraint digest_subscribers_billing_period_check
  check (billing_period is null or billing_period = any (array['monthly'::text, 'yearly'::text, 'halfyear'::text, 'gift'::text, 'free'::text]));
