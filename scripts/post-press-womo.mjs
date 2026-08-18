// Постить у Telegram-канал анонс першої медіа-публікації (WoMo, 18.08.2026)
// з брендованою карткою. Одноразовий пост, запускається руками через
// .github/workflows/press-post.yml (workflow_dispatch).

import { readFile } from 'node:fs/promises';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const DRY_RUN = process.env.DRY_RUN === 'true';

if (!TELEGRAM_BOT_TOKEN) {
  console.error('Missing TELEGRAM_BOT_TOKEN');
  process.exit(1);
}
if (!TELEGRAM_CHAT_ID) {
  console.error('Missing TELEGRAM_CHAT_ID');
  process.exit(1);
}

const ARTICLE_URL =
  'https://womo.ua/ukrayinka-stvoryla-bezplatnyj-katalog-mozhlyvostej-dlya-ditej/';
const CARD_PATH = 'public/press/womo-2026-08.png';

const caption = [
  '📰 <b>Про Dityam уперше написали медіа!</b>',
  '',
  'WoMo: «Гуртки, табори й стипендії в одному місці: українка створила платформу для батьків» 🧡',
  '',
  'У статті — як працює каталог: понад 200 джерел щодня, ручна перевірка кожної можливості, фільтри за віком і життєвою ситуацією — від таборів до стипендій. Безплатно, без реєстрації і реклами.',
  '',
  `📖 <a href="${ARTICLE_URL}">Прочитати статтю на WoMo</a>`,
  '',
  'Дякуємо редакції WoMo й авторці Оксані Хромовій. А вам — за те, що ви тут 🙌 Перешліть статтю батькам, яким це стане в пригоді.',
].join('\n');

if (DRY_RUN) {
  console.log('--- DRY RUN ---');
  console.log(caption);
  console.log(`(photo: ${CARD_PATH})`);
  process.exit(0);
}

const form = new FormData();
form.append('chat_id', TELEGRAM_CHAT_ID);
form.append('caption', caption);
form.append('parse_mode', 'HTML');
form.append(
  'photo',
  new Blob([await readFile(CARD_PATH)], { type: 'image/png' }),
  'dityam-womo.png'
);

const res = await fetch(
  `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
  { method: 'POST', body: form }
);

const json = await res.json();
if (!json.ok) {
  console.error(`Telegram API error: ${json.error_code} ${json.description}`);
  process.exit(1);
}
console.log(`✓ Press post sent (message_id=${json.result.message_id}).`);
