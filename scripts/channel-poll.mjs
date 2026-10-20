// Разове анонімне голосування в Telegram-каналі.
//
// Тексти — у scripts/channel-polls.js, тут лише надсилання. Яке саме
// опитування, вибирає env POLL (ключ із POLLS; типово «frequency»).
//
// Режими:
//   PREVIEW_CHAT=<chat_id> — обидва лише в цей чат (показати Марії), не в канал;
//   CONFIRM=POST            — у канал;
//   інакше                  — лише надрукувати, що пішло б.
// Канал — лише українською (правило Марії).
import { pollByKey } from './channel-polls.js';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL = process.env.TELEGRAM_CHAT_ID;
const PREVIEW = process.env.PREVIEW_CHAT || '';
const CONFIRM = process.env.CONFIRM || '';
const POLL = process.env.POLL || 'frequency';

const { intro: INTRO, question: QUESTION, options: OPTIONS, multiple: MULTIPLE = false } = pollByKey(POLL);

async function call(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(`${method}: ${j.description}`);
  return j.result;
}

async function main() {
  const target = PREVIEW || (CONFIRM === 'POST' ? CHANNEL : '');
  if (!target) {
    console.log(`[dry] Опитування «${POLL}»`);
    console.log(`[dry] Пост:\n${INTRO}\n\n[dry] Опитування: ${QUESTION}\n${OPTIONS.map((o) => `• ${o}`).join('\n')}`);
    console.log('[dry] Нічого не надіслано. У канал — confirm = POST; показати — preview_chat.');
    return;
  }
  if (!TOKEN) throw new Error('TELEGRAM_BOT_TOKEN не задано');
  await call('sendMessage', { chat_id: target, text: INTRO, parse_mode: 'HTML', disable_web_page_preview: true });
  // У приватному чаті (превʼю) анонімність не має сенсу — Telegram її там і не приймає.
  const poll = await call('sendPoll', {
    chat_id: target, question: QUESTION, options: OPTIONS.map((text) => ({ text })),
    is_anonymous: !PREVIEW, allows_multiple_answers: MULTIPLE,
  });
  console.log(`Надіслано ${PREVIEW ? 'превʼю' : 'в канал'} («${POLL}»): message_id ${poll.message_id}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
