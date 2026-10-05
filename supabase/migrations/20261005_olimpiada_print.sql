-- Друкований диплом онлайн-олімпіади з доставкою Новою поштою (100 грн понад
-- внесок): кому й куди надіслати, номер рахунку, коли оплачено й відправлено.
alter table public.olimpiada_entries add column if not exists print_order jsonb;
alter table public.olimpiada_entries add column if not exists print_ref text unique;
alter table public.olimpiada_entries add column if not exists print_paid_at timestamptz;
alter table public.olimpiada_entries add column if not exists print_sent_at timestamptz;

-- Запрошення до тесту листом на email батьків: коли надіслано
-- (scraper/olimpiada_invites.py, щоб не слати двічі).
alter table public.olimpiada_entries add column if not exists invite_sent_at timestamptz;
