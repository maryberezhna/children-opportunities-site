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

## Реакція "цікаво / не цікаво"

Під кожним постом — дві інлайн-кнопки `👍 Цікаво` / `👎 Не цікаво`.
Лічильники юзерам **не показуємо** (щоб думка одного не впливала на думку іншого).
Тап → Telegram дзвонить у вебхук на сайті → запис у `opportunity_feedback`
+ івент `opportunity_feedback` у Google Analytics 4.

### Одноразове налаштування

1. **Міграція БД** — виконати `supabase/migrations/20260509_telegram_feedback.sql`
   у Supabase SQL Editor (створює таблицю `opportunity_feedback`).

2. **Згенерувати webhook secret** (32+ випадкових символи):
   ```sh
   openssl rand -hex 32
   ```

3. **Створити GA4 API secret для Measurement Protocol**:
   GA4 → Admin → Data Streams → вибрати веб-стрім (`G-KPLE8LGH91`) →
   Measurement Protocol API secrets → Create → скопіювати `secret_value`.

4. **Додати env-змінні у Vercel** (Production + Preview):
   - `TELEGRAM_BOT_TOKEN` — той самий, що в GitHub Secrets
   - `TELEGRAM_WEBHOOK_SECRET` — секрет із кроку 2
   - `SUPABASE_SERVICE_ROLE_KEY` — той самий, що в GitHub Secrets
   - `GA4_API_SECRET` — секрет із кроку 3
   - `GA4_MEASUREMENT_ID` — `G-KPLE8LGH91` (опційно, є default)

   Передеплоїти, щоб env-змінні підхопились.

5. **Зареєструвати вебхук у Telegram** (без цього кроку ЖОДНА кнопка не працює —
   Telegram просто нема куди слати натискання).

   Найпростіше — через GitHub Actions (токен і секрет беруться з GitHub Secrets):

   > Actions → **"Telegram bot — register webhook"**
   > (`.github/workflows/telegram-set-webhook.yml`) → Run workflow →
   > `action = set`. Успіх у логах: `"description": "Webhook was set"`.
   > `action = info` показує поточний стан, `action = delete` знімає вебхук.

   Або локально (якщо є токен під рукою):
   ```sh
   TELEGRAM_BOT_TOKEN=... \
   TELEGRAM_WEBHOOK_SECRET=... \
   WEBHOOK_URL=https://dityam.com.ua/api/telegram/webhook \
     node scripts/set-telegram-webhook.mjs
   ```
   Перевірка стану: `ACTION=info node scripts/set-telegram-webhook.mjs`.

   Діагностика однією кнопкою: Actions → **"Telegram bot — diagnostics"**
   (`telegram-check.yml`) друкує `getWebhookInfo` (URL, `pending_update_count`,
   `last_error_message`), особу бота й права в каналі.

> ⚠️ **Секрет мусить збігатися з обох боків.** `secret_token`, з яким
> реєструється вебхук (GitHub Secret `TELEGRAM_WEBHOOK_SECRET`), має бути
> **точно таким самим**, як env `TELEGRAM_WEBHOOK_SECRET` на Vercel — інакше
> роут `app/api/telegram/webhook/route.js` відповідає **403 forbidden** і кнопки
> мовчать. Швидка перевірка збігу (без доступу до Vercel):
>
> ```sh
> curl -s -o /dev/null -w "%{http_code}\n" -X POST \
>   -H "x-telegram-bot-api-secret-token: <секрет>" \
>   --data '{"update_id":0}' https://dityam.com.ua/api/telegram/webhook
> ```
>
> `200` → секрети збігаються; `403` → різні (онови значення на Vercel і
> **Redeploy**); `500` → секрет на Vercel не заданий. Після зміни env на
> Vercel обовʼязково **Redeploy** — інакше нове значення не підхопиться
> (докочується до домену ~1–2 хв).

### Як читати голоси в Google Analytics

GA4 → Reports → Engagement → Events → шукати `opportunity_feedback`.
Параметри івента (треба зареєструвати як **Custom dimensions** один раз
у GA4 → Admin → Custom definitions, інакше в репорті будуть приховані):

- `value` — `yes` або `no`
- `action` — `add` (новий голос) / `switch` (перемкнув) / `remove` (зняв)
- `opportunity_id`, `opportunity_slug`, `opportunity_title`
- `source` — завжди `telegram`

Корисні Explore-репорти:
- розподіл `value` по всіх постах → загальний CTR "цікаво" vs "не цікаво";
- breakdown по `opportunity_title` → які типи постів резонують найкраще.

### Як читати голоси у Supabase (резерв)

```sql
SELECT
  o.title,
  COUNT(*) FILTER (WHERE f.value = 'yes') AS yes,
  COUNT(*) FILTER (WHERE f.value = 'no')  AS no
FROM opportunities o
LEFT JOIN opportunity_feedback f ON f.opportunity_id = o.id
WHERE o.telegram_posted_at IS NOT NULL
GROUP BY o.id, o.title
ORDER BY (COUNT(*) FILTER (WHERE f.value = 'yes')
        + COUNT(*) FILTER (WHERE f.value = 'no')) DESC
LIMIT 50;
```

### Поведінка

- Один Telegram-юзер = один голос на одну можливість.
- Повторний тап тієї ж кнопки → голос знімається (toast "Голос знято").
- Тап протилежної кнопки → перемикається (action=`switch`).
- Кнопки додаються тільки до **нових** постів. Старі залишаються без реакції.
- Лічильників на кнопках немає — щоб не створювати ефект bandwagon.

## Тижнева зведенка адміну

`scripts/feedback-digest.mjs` (workflow `.github/workflows/feedback-digest.yml`)
раз на тиждень (понеділок 09:00 Kyiv) шле в особистий чат адміна
повідомлення з топ-постами за `👍` та `👎` за останні 7 днів.

### Налаштування

1. **Дізнатись свій admin chat_id**:
   написати щось боту `@DityamComUABot` у DM, потім:
   ```sh
   curl "https://api.telegram.org/bot<TOKEN>/getUpdates" | jq '.result[].message.chat.id'
   ```
   Взяти число (типу `123456789` — без мінуса, особистий чат).
   Або створити приватну групу з ботом — тоді chat_id буде з мінусом.

2. **Додати GitHub Secret** `TELEGRAM_ADMIN_CHAT_ID` із цим числом.

3. **Тестовий запуск**: Actions → "Feedback digest — weekly summary to admin"
   → Run workflow → `dry_run = true` → подивитись лог.

### Що в зведенці

- Юзерів / голосів / постів за період.
- Топ-5 за `👍 цікаво` (з посиланнями на сайт).
- Топ-5 за `👎 не цікаво`.
- Якщо за тиждень ніхто не голосував — повідомлення "Голосів немає 🤷".

### Tuning

- Період: змінити cron у workflow (`'0 6 * * 1'` = понеділок) або
  ручний запуск з input `period_days=14`.
- Розмір топу: `TOP_N` env (default 5).

## Черга модерації кандидатів (агент → апрув у боті)

Агент-розвідник (`scraper/discover_agent.py`) складає нові знахідки в
`opportunities` зі `status='draft'`. Модерація відбувається **в особистому чаті
з ботом**, по одному кандидату за раз.

**Потік:**
1. `scripts/moderation-kickoff.mjs` (workflow `moderation-kickoff.yml`) раз на
   день шле в `TELEGRAM_ADMIN_CHAT_ID` пінг «🗂 Кандидати на апрув» з кнопкою
   **▶️ Переглянути** (`callback_data = mod:next`).
2. Тап ▶️ → вебхук викликає `sendNextCandidate()` → надсилає найстаріший драфт
   (за `updated_at ASC`) з кнопками:
   - **✅ Додати на сайт** (`mod:add`) → `status='active'`, `verified_at=now()`
   - **❌ Пропустити** (`mod:skip`) → `status='closed'`
   - **⏭ Відкласти** (`mod:later`) → лишається `draft`, лише `updated_at=now()`
     (падає в кінець черги)
   - **✏️ Редагувати** → URL-кнопка на `/admin/edit/<id>` (форма правки)
3. Після ✅/❌/⏭ картка редагується на статус-підпис і **автоматично** приходить
   наступний кандидат. Коли черга порожня — «✅ Черга порожня».
4. Рішення ✅/❌ дзеркаляться в Notion через `pushModeration()` (env-gated
   `NOTION_TOKEN` + `NOTION_MODERATION_DB`; якщо не задані — просто пропускається).

**Команди в чаті** (потрібні `allowed_updates: ['callback_query','message']`
при реєстрації — вже так у `set-telegram-webhook.mjs`): `/start`, `/next`,
`/moderate` — усі стартують чергу з наступного драфта.

**Хто може модерувати:** якщо `TELEGRAM_ADMIN_CHAT_ID` заданий на Vercel — лише
тапи з цього `from.id` **або** з цього `chat.id` (у приватному чаті вони рівні).
Якщо не заданий — дозволено будь-кому. При відмові тост показує `Твій id: …`,
щоб було легко вписати правильне значення.

**Env на Vercel для модерації:** `TELEGRAM_ADMIN_CHAT_ID` (хто модерує),
`ADMIN_TOKEN` (доступ до `/admin` і `/admin/edit`), `SITE_URL` (для URL-кнопки
✏️, default `https://dityam.com.ua`).

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
