# Telegram-бот: автопости нових можливостей

Публікує нові записи з таблиці `opportunities` у Telegram-канал.
Запускається GitHub Actions кожні 4 години (`.github/workflows/telegram-bot.yml`).

## Як це працює

1. Скрипт `scripts/post-to-telegram.mjs` бере з Supabase усі записи,
   де `telegram_posted_at IS NULL`, по `created_at ASC`, до `MAX_PER_RUN` штук.
2. Для кожного формує HTML-повідомлення (заголовок, тип, вік, дедлайн, опис, лінк на сайт).
3. Шле через Bot API в `TELEGRAM_CHAT_ID`.
4. Після успішного посту — проставляє `telegram_posted_at = now()`,
   щоб не задублювати наступним запуском.

## Setup (одноразово)

### 1. Міграція БД

В Supabase SQL Editor:

```sql
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS telegram_posted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS opportunities_telegram_posted_at_idx
  ON opportunities (telegram_posted_at)
  WHERE telegram_posted_at IS NULL;
```

> Бекфіл: щоб бот не запостив одразу всі 280 існуючих записів,
> позначаємо їх як уже опубліковані:
>
> ```sql
> UPDATE opportunities
>    SET telegram_posted_at = now()
>  WHERE telegram_posted_at IS NULL;
> ```
>
> Тоді бот почне постити тільки нові записи, які з'являться після цього моменту.

### 2. Створити бота й канал

1. У Telegram написати `@BotFather` → `/newbot` → отримати `TELEGRAM_BOT_TOKEN`.
2. Створити публічний канал (наприклад, `@dityam_opportunities`).
3. Додати бота адміном каналу з правом "Post Messages".
4. Дізнатися `chat_id` каналу:
   - публічний канал: `TELEGRAM_CHAT_ID = "@dityam_opportunities"` (з `@`).
   - приватний канал: написати в канал будь-що, потім
     `curl https://api.telegram.org/bot<TOKEN>/getUpdates` →
     взяти `chat.id` (буде число типу `-1001234567890`).

### 3. Сервісний ключ Supabase

Скрипт оновлює `telegram_posted_at`, тож anon-ключа замало.
В Supabase → Project Settings → API → скопіювати `service_role` (secret).

> ⚠️ `service_role` обходить RLS. Він має бути ТІЛЬКИ в GitHub Secrets,
> ніколи не в коді й не в `.env`, що комітиться.

### 4. Додати GitHub Secrets

Repo → Settings → Secrets and variables → Actions → New repository secret:

- `TELEGRAM_BOT_TOKEN` — з кроку 2.1
- `TELEGRAM_CHAT_ID` — з кроку 2.4
- `SUPABASE_SERVICE_ROLE_KEY` — з кроку 3
- `NEXT_PUBLIC_SUPABASE_URL` — вже є (використовується іншими workflow-ами)

### 5. Тестовий запуск

Repo → Actions → "Telegram bot — post new opportunities" → Run workflow →
поставити `dry_run = true` → подивитись логи (повідомлення друкуються, нічого не шлеться).

Якщо все ок — запустити з `dry_run = false`. Перші пости з'являться в каналі.

## Tuning

- Частота: змінити `cron` у workflow (`'0 */4 * * *'` = кожні 4 години).
- Кількість за запуск: `MAX_PER_RUN` (default 8). Telegram має ліміт ~30 повідомлень/секунду
  до різних чатів і ~1/сек до того самого, тож скрипт спить 1.5с між постами.
- Формат повідомлення: функція `buildMessage()` у `post-to-telegram.mjs`.

## Чому канал, а не персональні DM

Канал = ноль інфраструктури: не треба зберігати юзерів, обробляти `/start`,
підтримувати webhook-сервер. Користувач підписується сам, фільтрує сам (через пошук у каналі).

Якщо колись захочеться персоналізації (фільтри по віку/типу/регіону) —
це окремий етап: треба буде webhook-сервер (наприклад, Vercel Edge Function),
таблиця `subscribers` з налаштуваннями, команди `/start`, `/settings`, `/stop`.
