-- Олімпіада з логіки через Telegram (Марія, 13.10.2026: «щоб в телеграм боті
-- можна було пройти безкоштовну олімпіаду… бо з імейлами проблема, перенеси
-- все туди»; листи масово повертались). Запис привʼязується до чату
-- @DityamPlusBot: посилання на тест і диплом приходять туди, пошти немає.
alter table public.olimpiada_entries add column if not exists telegram_chat_id text;
create index if not exists olimpiada_entries_tg_idx on public.olimpiada_entries (telegram_chat_id, created_at desc);
