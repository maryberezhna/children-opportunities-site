-- Телефон підписника (ділиться через Telegram-кнопку request_contact),
-- підставляється у форму оплати WayForPay (clientPhone).
alter table digest_subscribers add column if not exists phone text;
