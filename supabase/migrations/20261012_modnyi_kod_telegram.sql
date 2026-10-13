-- «Модний код» через бот Dityam+ (12.10.2026, Марія: «будувати все через
-- телеграм»; «бот Dityam+ реєструє на ці можливості й має їх у своєму меню з
-- безлімітною кількістю проходжень»). Запис із бота — без email, з chat id.
alter table public.mk_entries add column if not exists telegram_chat_id text;
alter table public.mk_entries alter column parent_email drop not null;
alter table public.mk_entries add column if not exists practice_count integer not null default 0;
create index if not exists mk_entries_chat_idx on public.mk_entries (telegram_chat_id);
