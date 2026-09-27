// Дослід: де саме гине емодзі в повідомленнях @DityamPlusBot.
//
// Симптом (Марія, 19.09 і 27.09.2026): у тексті повідомлення замість 🎟 і 🧡
// приїжджає літерами «🎟» і «🧡». На кнопці те саме
// емодзі малюється нормально. У джерелі (app/api/telegram/plus/route.js)
// лежить справжній символ — перевірено байтами.
//
// Що робить скрипт: шле те саме, що askConsent, у адмінський чат і друкує
// кодові точки того, що Telegram ПОВЕРНУВ у result.text. Далі однозначно:
//   • повернулось 🧡 одним символом  → наш бік і Telegram чисті, ламає збірка
//     Vercel або те, що дійшло до неї;
//   • повернулись 12 символів «\uD83E…» → ламається ще до Telegram.
const TOKEN = process.env.TELEGRAM_PLUS_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_ADMIN_CHAT_ID;
if (!TOKEN || !CHAT) { console.error('Missing TELEGRAM_PLUS_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID'); process.exit(1); }

const HEART = '\u{1F9E1}';   // 🧡  — не BMP, сурогатна пара
const TICKET = '\u{1F39F}';  // 🎟  — те саме, що зламалось 19.09
const CHECK = '✅';      // ✅  — BMP, як контроль

const cases = [
  ['текст + HTML', { text: `${HEART} <b>Проба</b> ${TICKET} ${CHECK}`, parse_mode: 'HTML' }],
  ['текст без HTML', { text: `${HEART} Проба ${TICKET} ${CHECK}` }],
  ['на кнопці', {
    text: 'Проба: емодзі на кнопці',
    reply_markup: { inline_keyboard: [[{ text: `${HEART} Кнопка ${TICKET}`, callback_data: 'diag' }]] },
  }],
];

const points = (s) => [...String(s)].map((ch) => {
  const cp = ch.codePointAt(0);
  return cp > 0x7f ? `U+${cp.toString(16).toUpperCase()}` : ch;
}).join(' ');

for (const [name, extra] of cases) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT, disable_web_page_preview: true, ...extra }),
  });
  const body = await res.json().catch(() => ({}));
  console.log(`\n--- ${name} ---`);
  if (!body.ok) { console.log(`   помилка: ${res.status} ${body.description}`); continue; }
  console.log(`   надіслали:  ${points(extra.text)}`);
  console.log(`   повернулось: ${points(body.result.text || '')}`);
  const btn = body.result.reply_markup?.inline_keyboard?.[0]?.[0]?.text;
  if (btn) console.log(`   кнопка:     ${points(btn)}`);
}
