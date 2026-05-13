// Постить у Telegram-канал тижневе нагадування про підтримку проєкту.
// Запускається GitHub Actions раз на тиждень (.github/workflows/support-post.yml)
// або руками через workflow_dispatch.

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

const MONOBANK_JAR = 'https://send.monobank.ua/jar/F72fDrV2c';
const MONOBANK_BASE = 'https://base.monobank.ua/5QKZeVxPVjZEx7';
const SUPPORT_PAGE = 'https://dityam.com.ua/support';

const message = [
  'Команда <b>Dityam.com.ua</b> вірить, що кожна дитина в Україні має знати про свої можливості — від безкоштовного гуртка у своєму місті до стипендії за кордон.',
  '',
  'Якщо маєте змогу підтримати, будемо дуже вдячні, адже це допоможе проєкту розвиватися і додавати більше можливостей для дітей:',
  '',
  '• перевіряти й додавати нові програми',
  '• тримати каталог актуальним і безкоштовним',
  '• розвивати платформу далі 🧡',
  '',
  `🏦 <a href="${MONOBANK_JAR}">Банка monobank</a> — разовий внесок будь-якою сумою`,
  `💳 <a href="${MONOBANK_BASE}">Підписка monobank Base</a> — щомісячна підтримка`,
  `🌍 <a href="${SUPPORT_PAGE}">PayPal / картка з-за кордону</a> — на сторінці підтримки сайту`,
].join('\n');

if (DRY_RUN) {
  console.log('--- DRY RUN ---');
  console.log(message);
  process.exit(0);
}

const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chat_id: TELEGRAM_CHAT_ID,
    text: message,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  }),
});

const json = await res.json();
if (!json.ok) {
  console.error(`Telegram API error: ${json.error_code} ${json.description}`);
  process.exit(1);
}
console.log(`✓ Support post sent (message_id=${json.result.message_id}).`);
