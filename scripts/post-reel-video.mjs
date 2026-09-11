// Надсилає готовий рілс в адмінський чат Telegram — щоб подивитись його з
// телефона перед публікацією. Рендери лежать поза репозиторієм і важать
// десятки мегабайтів, тому файл приїжджає ассетом чернеткового релізу, а не
// комітом: .github/workflows/reel-post.yml (workflow_dispatch).

import { readFile, stat } from 'node:fs/promises';
import { basename } from 'node:path';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const VIDEO_PATH = process.env.VIDEO_PATH;
const CAPTION = process.env.CAPTION || '';
const DRY_RUN = process.env.DRY_RUN === 'true';

// Ліміт Bot API на завантаження файлу ботом.
const MAX_BYTES = 50 * 1024 * 1024;

if (!TELEGRAM_BOT_TOKEN) {
  console.error('Missing TELEGRAM_BOT_TOKEN');
  process.exit(1);
}
if (!TELEGRAM_ADMIN_CHAT_ID) {
  console.error('Missing TELEGRAM_ADMIN_CHAT_ID');
  process.exit(1);
}
if (!VIDEO_PATH) {
  console.error('Missing VIDEO_PATH');
  process.exit(1);
}

const info = await stat(VIDEO_PATH).catch(() => null);
if (!info) {
  console.error(`Файл не знайдено: ${VIDEO_PATH}`);
  process.exit(1);
}
if (info.size > MAX_BYTES) {
  const mb = (info.size / 1024 / 1024).toFixed(1);
  console.error(`Файл ${mb} МБ — більше за ліміт Bot API у 50 МБ.`);
  process.exit(1);
}

const name = basename(VIDEO_PATH);
const sizeMb = (info.size / 1024 / 1024).toFixed(1);

if (DRY_RUN) {
  console.log('--- DRY RUN ---');
  console.log(`video: ${name} (${sizeMb} МБ) → chat ${TELEGRAM_ADMIN_CHAT_ID}`);
  console.log(`caption: ${CAPTION || '(без підпису)'}`);
  process.exit(0);
}

const form = new FormData();
form.append('chat_id', TELEGRAM_ADMIN_CHAT_ID);
if (CAPTION) {
  form.append('caption', CAPTION);
  form.append('parse_mode', 'HTML');
}
// supports_streaming — щоб застосунок програв відео, а не віддав його файлом.
form.append('supports_streaming', 'true');
form.append('video', new Blob([await readFile(VIDEO_PATH)], { type: 'video/mp4' }), name);

const res = await fetch(
  `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVideo`,
  { method: 'POST', body: form }
);

const json = await res.json();
if (!json.ok) {
  console.error(`Telegram API error: ${json.error_code} ${json.description}`);
  process.exit(1);
}
console.log(`✓ Надіслано ${name} (${sizeMb} МБ), message_id=${json.result.message_id}.`);
