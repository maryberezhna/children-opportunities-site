/**
 * Публікує в канал готовий текст із файлу.
 *
 * Навіщо окремо від post-to-telegram.mjs. Той збирає пости сам із бази — це
 * щоденний потік. Але буває пост, який хочеться написати руками: сильний
 * перший рядок, свій акцент, вичитаний текст. Досі під кожен такий пост
 * заводили окремий скрипт і окремий воркфлоу (post-sept1-hurtky, post-press-
 * womo, post-support-message) — і репозиторій обростав одноразовими файлами.
 *
 * Тут навпаки: скрипт один, а пост — це файл у content/telegram/. Написати
 * новий пост = додати файл і запустити воркфлоу з його імʼям.
 *
 * Текст — у форматі Telegram HTML: <b>, <i>, <a href>. Решта тегів заборонена
 * самим Telegram, тож перевіряємо це до відправки, а не ловимо 400 у відповіді.
 *
 * Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, FILE, DRY_RUN=true.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const FILE = process.env.FILE || process.argv[2];
const DRY = String(process.env.DRY_RUN || '').toLowerCase() === 'true';
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_CHAT_ID;

if (!FILE) {
  console.error('Вкажи файл: FILE=content/telegram/…​.html');
  process.exit(1);
}
if (!DRY && (!TOKEN || !CHAT)) {
  console.error('Потрібні TELEGRAM_BOT_TOKEN і TELEGRAM_CHAT_ID');
  process.exit(1);
}

// Дозволені теги — рівно ті, що розуміє Telegram у parse_mode=HTML.
// Друкарська помилка в тезі інакше повертається як 400 уже після того, як
// людина натиснула «запустити», і без пояснення, де саме.
const ALLOWED = /^(b|strong|i|em|u|s|code|pre|a|blockquote|tg-spoiler)$/;

const text = (await readFile(resolve(FILE), 'utf8')).trim();
if (!text) {
  console.error(`Файл ${FILE} порожній.`);
  process.exit(1);
}

const bad = [...text.matchAll(/<\/?([a-zA-Z-]+)[^>]*>/g)]
  .map((m) => m[1].toLowerCase())
  .filter((tag) => !ALLOWED.test(tag));
if (bad.length) {
  console.error(`Telegram не приймає теги: ${[...new Set(bad)].join(', ')}`);
  process.exit(1);
}

const plain = text.replace(/<[^>]+>/g, '');
if (plain.length > 4096) {
  console.error(`Задовго: ${plain.length} символів, ліміт 4096.`);
  process.exit(1);
}

console.log(`Файл: ${FILE}`);
console.log(`Символів: ${plain.length} з 4096\n`);
console.log('─'.repeat(60));
console.log(plain.trim());
console.log('─'.repeat(60));

if (DRY) {
  console.log('\nDRY_RUN — нічого не надіслано.');
  process.exit(0);
}

const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ chat_id: CHAT, text, parse_mode: 'HTML' }),
});
const json = await res.json();
if (!json.ok) {
  console.error(`\nTelegram відмовив: ${json.description}`);
  process.exit(1);
}
console.log(`\n✅ Опубліковано. message_id ${json.result.message_id}`);
