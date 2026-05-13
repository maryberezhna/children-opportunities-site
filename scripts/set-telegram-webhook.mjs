// Реєструє вебхук Telegram → /api/telegram/webhook сайту.
// Запуск: TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... \
//         WEBHOOK_URL=https://dityam.com.ua/api/telegram/webhook \
//         node scripts/set-telegram-webhook.mjs
//
// Передати ACTION=delete щоб зняти вебхук.
// Передати ACTION=info щоб подивитись поточний стан.

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const URL = process.env.WEBHOOK_URL;
const ACTION = process.env.ACTION || 'set';

if (!TOKEN) {
  console.error('Missing TELEGRAM_BOT_TOKEN');
  process.exit(1);
}

const TG = `https://api.telegram.org/bot${TOKEN}`;

async function call(method, body) {
  const res = await fetch(`${TG}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

if (ACTION === 'info') {
  const info = await call('getWebhookInfo');
  console.log(JSON.stringify(info, null, 2));
  process.exit(info.ok ? 0 : 1);
}

if (ACTION === 'delete') {
  const res = await call('deleteWebhook', { drop_pending_updates: false });
  console.log(JSON.stringify(res, null, 2));
  process.exit(res.ok ? 0 : 1);
}

if (!URL) {
  console.error('Missing WEBHOOK_URL (e.g. https://dityam.com.ua/api/telegram/webhook)');
  process.exit(1);
}
if (!SECRET) {
  console.error('Missing TELEGRAM_WEBHOOK_SECRET (any random 32+ char string)');
  process.exit(1);
}

const res = await call('setWebhook', {
  url: URL,
  secret_token: SECRET,
  // We only need callback_query for the feedback buttons; skip everything else
  // so the bot doesn't get spammed with messages from the channel.
  allowed_updates: ['callback_query'],
  drop_pending_updates: true,
});

console.log(JSON.stringify(res, null, 2));
process.exit(res.ok ? 0 : 1);
