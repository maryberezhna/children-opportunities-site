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
 * TO_ADMIN=true шле пост не в канал, а в адмінський чат — щоб подивитись,
 * як він справді виглядає в Telegram, перш ніж його побачать люди. Марія,
 * 19.10.2026, про щоденний пост із дедлайнами: «мені не подобається такий
 * дизайн… пришли мені в адмінку». Сухий прогін показує текст у логах
 * GitHub — а вигляд поста вирішують жирний шрифт, посилання й відступи,
 * яких у логах не видно.
 *
 * Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, FILE, DRY_RUN=true,
 * TO_ADMIN (необовʼязково: у чат TELEGRAM_ADMIN_CHAT_ID замість каналу),
 * MESSAGE_ID (необовʼязково: виправити цей пост, а не публікувати новий),
 * PHOTOS (необовʼязково: картинки через кому — пост піде альбомом).
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { resolveTokens, hasTokens } from './telegram-counters.mjs';
import { tagSiteLinks, UTM_CHANNEL } from '../lib/utm.js';

const FILE = process.env.FILE || process.argv[2];
const DRY = String(process.env.DRY_RUN || '').toLowerCase() === 'true';
// PIN=true — закріпити пост у каналі одразу після відправки (без сповіщення).
const PIN = String(process.env.PIN || '').toLowerCase() === 'true';
// PHOTOS — шляхи до картинок у репозиторії через кому. Тоді пост іде
// альбомом, а текст стає підписом до першої картинки: Telegram показує це
// одним постом (Марія, 07.10.2026: «можна і телеграм ці картинки як для
// інстаграму»). Підпис у Telegram коротший за повідомлення — 1024 символи.
const PHOTOS = String(process.env.PHOTOS || '').split(',').map((s) => s.trim()).filter(Boolean);
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
// Превʼю йде в адмінський чат. Закріплювати там нічого: PIN лишається
// тільки для справжньої публікації в канал.
const TO_ADMIN = String(process.env.TO_ADMIN || '').toLowerCase() === 'true';
const CHAT = TO_ADMIN ? process.env.TELEGRAM_ADMIN_CHAT_ID : process.env.TELEGRAM_CHAT_ID;

if (!FILE) {
  console.error('Вкажи файл: FILE=content/telegram/…​.html');
  process.exit(1);
}
if (!DRY && (!TOKEN || !CHAT)) {
  console.error(`Потрібні TELEGRAM_BOT_TOKEN і ${TO_ADMIN ? 'TELEGRAM_ADMIN_CHAT_ID' : 'TELEGRAM_CHAT_ID'}`);
  process.exit(1);
}

// Дозволені теги — рівно ті, що розуміє Telegram у parse_mode=HTML.
// Друкарська помилка в тезі інакше повертається як 400 уже після того, як
// людина натиснула «запустити», і без пояснення, де саме.
const ALLOWED = /^(b|strong|i|em|u|s|code|pre|a|blockquote|tg-spoiler)$/;

const raw = (await readFile(resolve(FILE), 'utf8')).trim();
if (!raw) {
  console.error(`Файл ${FILE} порожній.`);
  process.exit(1);
}

// Числа в тексті не пишуться руками — вони підставляються з бази просто зараз.
// Пост «639 безкоштовних можливостей» із обіцянкою «точне число на сьогодні»
// був неправдою того ж дня: насправді їх було 687 (13.09.2026).
let text = raw;
if (hasTokens(raw)) {
  try {
    const r = await resolveTokens(raw, {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    });
    text = r.text;
    console.log('Живі числа:');
    for (const line of r.used) console.log(`  ${line}`);
    console.log('');
  } catch (e) {
    console.error(`\n${e.message}`);
    process.exit(1);
  }
}

const bad = [...text.matchAll(/<\/?([a-zA-Z-]+)[^>]*>/g)]
  .map((m) => m[1].toLowerCase())
  .filter((tag) => !ALLOWED.test(tag));
if (bad.length) {
  console.error(`Telegram не приймає теги: ${[...new Set(bad)].join(', ')}`);
  process.exit(1);
}

const plain = text.replace(/<[^>]+>/g, '');
const LIMIT = PHOTOS.length ? 1024 : 4096;
if (plain.length > LIMIT) {
  console.error(`Задовго: ${plain.length} символів, ліміт ${LIMIT}${PHOTOS.length ? ' (підпис до картинок)' : ''}.`);
  process.exit(1);
}
if (PHOTOS.length > 10) {
  console.error(`Картинок ${PHOTOS.length}, в альбомі Telegram — не більше 10.`);
  process.exit(1);
}
if (PHOTOS.length && process.env.MESSAGE_ID) {
  console.error('Виправити альбом цим скриптом не можна: MESSAGE_ID лише для текстових постів.');
  process.exit(1);
}
// Читаємо картинки до відправки: помилка в шляху має зупинити запуск ще
// в сухому прогоні, а не після того, як текст уже пішов у канал.
const photos = [];
for (const p of PHOTOS) {
  try {
    photos.push({ name: p.split('/').pop(), data: await readFile(resolve(p)) });
  } catch {
    console.error(`Немає картинки: ${p}`);
    process.exit(1);
  }
}

console.log(`Файл: ${FILE}`);
console.log(TO_ADMIN ? 'Куди: адмінський чат (превʼю)' : 'Куди: канал');
console.log(`Символів: ${plain.length} з ${LIMIT}`);
for (const ph of photos) console.log(`Картинка: ${ph.name} (${Math.round(ph.data.length / 1024)} КБ)`);
console.log('');
console.log('─'.repeat(60));
console.log(plain.trim());
console.log('─'.repeat(60));

if (DRY) {
  console.log('\nDRY_RUN — нічого не надіслано.');
  process.exit(0);
}

// MESSAGE_ID — виправити вже опублікований пост замість нового. 27.09.2026 пост
// про конкурс вийшов із посиланням на організатора замість сторінки на сайті;
// видалити й надіслати заново — це ще одне сповіщення підписникам того ж дня.
const EDIT_ID = Number(process.env.MESSAGE_ID) || null;
const body = tagSiteLinks(text, { ...UTM_CHANNEL, content: 'post' });
let res;
if (photos.length) {
  // Файли йдуть самі (multipart), а не посиланнями: картинки лежать у
  // репозиторії, на сайті їх немає. Одна картинка — sendPhoto, кілька — альбом.
  const form = new FormData();
  form.append('chat_id', CHAT);
  if (photos.length === 1) {
    form.append('photo', new Blob([photos[0].data]), photos[0].name);
    form.append('caption', body);
    form.append('parse_mode', 'HTML');
  } else {
    photos.forEach((ph, i) => form.append(`p${i}`, new Blob([ph.data]), ph.name));
    form.append('media', JSON.stringify(photos.map((ph, i) => ({
      type: 'photo', media: `attach://p${i}`,
      ...(i === 0 ? { caption: body, parse_mode: 'HTML' } : {}),
    }))));
  }
  const method = photos.length === 1 ? 'sendPhoto' : 'sendMediaGroup';
  res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, { method: 'POST', body: form });
} else {
  const method = EDIT_ID ? 'editMessageText' : 'sendMessage';
  res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT, text: body, parse_mode: 'HTML',
      ...(EDIT_ID ? { message_id: EDIT_ID } : {}),
    }),
  });
}
const json = await res.json();
if (!json.ok) {
  console.error(`\nTelegram відмовив: ${json.description}`);
  process.exit(1);
}
// Альбом повертає масив повідомлень; закріплюємо й називаємо перше — з підписом.
const messageId = Array.isArray(json.result) ? json.result[0].message_id : json.result.message_id;
console.log(EDIT_ID
  ? `\n✅ Пост ${EDIT_ID} виправлено.`
  : `\n✅ Опубліковано. message_id ${messageId}`);
if (PIN && !EDIT_ID && !TO_ADMIN) {
  const pin = await fetch(`https://api.telegram.org/bot${TOKEN}/pinChatMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT, message_id: messageId, disable_notification: true }),
  });
  const pj = await pin.json();
  if (!pj.ok) {
    console.error(`Пост є, але закріпити не вдалося: ${pj.description}`);
    process.exit(1);
  }
  console.log('📌 Закріплено.');
}
