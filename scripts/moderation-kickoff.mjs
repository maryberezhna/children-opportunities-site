// Sends a "review candidates" prompt to the admin chat with a ▶️ button that
// starts the one-by-one moderation queue in the bot. Run via the
// "Moderation kickoff" workflow (workflow_dispatch).
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_ADMIN_CHAT_ID;

if (!TOKEN || !CHAT) {
  console.error('Missing TELEGRAM_BOT_TOKEN / TELEGRAM_ADMIN_CHAT_ID');
  process.exit(1);
}

const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chat_id: CHAT,
    text: '🗂 <b>Кандидати на апрув</b>\nПереглянути по одному:',
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: [[{ text: '▶️ Переглянути', callback_data: 'mod:next' }]] },
  }),
});
const json = await res.json();
console.log(json.ok ? 'Kickoff sent ✅' : `Failed: ${JSON.stringify(json)}`);
process.exit(json.ok ? 0 : 1);
