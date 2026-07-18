-- Діалогова форма в Telegram-боті: бот ставить питання по одному, стан кроку
-- зберігаємо прямо в рядку підписника (serverless-вебхук не має памʼяті між запитами).
--
-- flow_step: 'age' | 'interests' | 'gender' | 'cost' | null(=форму завершено)

alter table digest_subscribers add column if not exists flow_step text;

-- один рядок на один чат — щоб /start у боті оновлював профіль, а не плодив дублі
create unique index if not exists digest_subscribers_chat_uidx
  on digest_subscribers (telegram_chat_id) where telegram_chat_id is not null;
