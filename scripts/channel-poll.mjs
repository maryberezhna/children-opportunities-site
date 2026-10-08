// Разове анонімне голосування в Telegram-каналі: як часто публікувати
// можливості (Марія, 08.10.2026: «хочемо бути на одній хвилі, ви маєте
// можливість управляти нашими рішеннями… анонімно»).
//
// Спершу короткий пост-пояснення, одразу за ним — саме опитування. Режими:
//   PREVIEW_CHAT=<chat_id> — обидва лише в цей чат (показати Марії), не в канал;
//   CONFIRM=POST            — у канал;
//   інакше                  — лише надрукувати, що пішло б.
// Канал — лише українською (правило Марії).

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL = process.env.TELEGRAM_CHAT_ID;
const PREVIEW = process.env.PREVIEW_CHAT || '';
const CONFIRM = process.env.CONFIRM || '';

export const INTRO = '🧡 <b>Хочемо бути з вами на одній хвилі</b>\n\n'
  + 'Ви можете впливати на наші рішення. Скажіть, як часто вам зручно отримувати можливості в каналі, '
  + '— так і будемо публікувати.\n\n'
  + 'Голосування анонімне: ніхто, навіть ми, не бачить, хто як проголосував.';

export const QUESTION = 'Як часто вам зручно отримувати можливості в каналі?';
// Від частішого до рідшого (Марія, 08.10.2026: «стоп, а частіше», «так часто,
// як зʼявляються», «раз на тиждень прибери»).
// «Як зараз» — за фактом каналу, а не за розкладом: 02–07.10.2026 виходило
// 2–3 пости на день (розклад GitHub запізнюється й пропускає запуски).
export const OPTIONS = [
  'Так часто, як зʼявляються',
  '2–3 рази на день, як зараз',
  'Раз на день',
  'Кілька разів на тиждень',
];

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
    console.log(`[dry] Пост:\n${INTRO}\n\n[dry] Опитування: ${QUESTION}\n${OPTIONS.map((o) => `• ${o}`).join('\n')}`);
    console.log('[dry] Нічого не надіслано. У канал — confirm = POST; показати — preview_chat.');
    return;
  }
  if (!TOKEN) throw new Error('TELEGRAM_BOT_TOKEN не задано');
  await call('sendMessage', { chat_id: target, text: INTRO, parse_mode: 'HTML', disable_web_page_preview: true });
  // У приватному чаті (превʼю) анонімність не має сенсу — Telegram її там і не приймає.
  const poll = await call('sendPoll', {
    chat_id: target, question: QUESTION, options: OPTIONS.map((text) => ({ text })),
    is_anonymous: !PREVIEW, allows_multiple_answers: false,
  });
  console.log(`Надіслано ${PREVIEW ? 'превʼю' : 'в канал'}: message_id ${poll.message_id}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
