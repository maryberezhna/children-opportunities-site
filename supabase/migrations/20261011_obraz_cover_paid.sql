-- «Твій образ на обкладинці» (11.10.2026): участь платна — оргвнесок 99 грн
-- (Марія: «треба платне, бо в нас немає грошей»). Малюнок стає обкладинкою
-- модного журналу dityam.com.ua.
--
-- Статуси: unpaid — заявку й фото отримали, оплати ще немає (у «Черзі» не
-- видно); pending — оплачено, чекає на Марію; approved — у галереї;
-- reupload — фото не підійшло, батьки надсилають інше без доплати;
-- rejected — старий статус безкоштовного пілота; removed — прибрали батьки.
alter table public.obraz_entries
  add column if not exists designer_word text check (designer_word in ('дизайнер', 'дизайнерка')),
  add column if not exists fabric text,
  add column if not exists amount integer not null default 99,
  add column if not exists paid_at timestamptz,
  add column if not exists wfp_order_reference text,
  add column if not exists wfp_last_status text,
  add column if not exists wfp_last_reason text,
  add column if not exists reupload_at timestamptz;

alter table public.obraz_entries drop constraint if exists obraz_entries_status_check;
alter table public.obraz_entries add constraint obraz_entries_status_check
  check (status in ('unpaid', 'pending', 'approved', 'reupload', 'rejected', 'removed'));
alter table public.obraz_entries alter column status set default 'unpaid';

create index if not exists obraz_entries_order_idx on public.obraz_entries (wfp_order_reference);
