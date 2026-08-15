// Разовий анонс Dityam+ у канал: збираємо список очікування одним тапом.
// Кнопка веде в бота (t.me/DityamComUABot?start=plus) — бот зберігає chat_id
// у plus_waitlist. Це свідомо не email-форма: набирати пошту в месенджері
// незручно, а chat_id — прямий канал, куди й прийде повідомлення про запуск.
//
// Запуск: workflow "Plus announcement (Telegram)" (workflow_dispatch).
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_CHAT_ID;        // канал Dityam.com.ua
const DRY = process.env.DRY_RUN === 'true';

if (!TOKEN || !CHAT) {
  console.error('Missing TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID');
  process.exit(1);
}

const text = [
  '🧡 <b>Dityam+ — скоро</b>',
  '',
  'Ми готуємо <b>платну помісячну підписку</b> — помічник для батьків, який зніме з вас рутину:',
  '— сам відбиратиме можливості під вік та інтереси вашої дитини',
  '— нагадає про дедлайн за тиждень і ще раз за два дні',
  '— допоможе розібратися з подачею заявки',
  '',
  'Каталог dityam.com.ua був і лишається безкоштовним для всіх — це не зміниться.',
  '',
  '<b>Першим — знижка на старті.</b> Хочете в список перших? Один тап 👇',
].join('\n');

const payload = {
  chat_id: CHAT,
  text,
  parse_mode: 'HTML',
  disable_web_page_preview: true,
  reply_markup: {
    inline_keyboard: [[
      { text: '🚀 Хочу першим', url: 'https://t.me/DityamComUABot?start=plus' },
    ]],
  },
};

if (DRY) {
  console.log('DRY RUN — не надсилаю. Текст:\n');
  console.log(text);
  process.exit(0);
}

const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
const json = await res.json();
console.log(json.ok ? 'Анонс опубліковано ✅' : `Failed: ${JSON.stringify(json)}`);
process.exit(json.ok ? 0 : 1);
