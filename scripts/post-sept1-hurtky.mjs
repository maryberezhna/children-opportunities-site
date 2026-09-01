// Постить у Telegram-канал пост до 1 вересня про гуртки і одразу за ним —
// опитування «А ви вже обрали гурток на цей рік?». Одноразовий пост,
// запускається руками через .github/workflows/sept1-post.yml (workflow_dispatch).
//
// Цифри в тексті — з бази на 01.09.2026: 621 гурток/курс/майстер-клас додано
// з 17 серпня, 826 активних загалом, 469 із них безкоштовні.

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

const text = [
  '<b>Сьогодні 1 вересня 🎒</b>',
  '',
  'Повітряні тривоги, на жаль, не вщухають. Але осінь настала, школа почалася — і разом із нею час позашкілля.',
  '',
  'Коли ще, як не зараз, знайти дитині гурток за інтересами? Останні кілька тижнів ми наполегливо працювали саме для цього:',
  '',
  '➕ понад 600 нових гуртків і курсів лише за два останні тижні',
  '📚 разом на платформі — вже понад 800 гуртків і курсів для дітей 0–18',
  '🆓 понад 460 із них — повністю безкоштовні',
  '',
  'Усе в одному місці, на кожній картці — вік, місто і формат:',
  '👉 <a href="https://dityam.com.ua/bezkoshtovni-hurtky">Безкоштовні гуртки та курси</a>',
  '👉 <a href="https://dityam.com.ua">Усі можливості для дітей</a>',
  '',
  'А хочете, щоб ми підібрали можливості саме під вашу дитину — станьте в <a href="https://dityam.com.ua/pidbirka">список очікування Dityam+</a>, першим буде знижка 🧡',
  '',
  'Ми також в <a href="https://www.instagram.com/dityam.com.ua">Instagram</a>',
  '',
  'А ви вже обрали гурток на цей рік? 👇',
].join('\n');

const pollQuestion = 'А ви вже обрали гурток на цей рік?';
const pollOptions = ['✅ Так', '❌ Ні', '🔍 Якраз шукаємо'];

if (DRY_RUN) {
  console.log('--- DRY RUN ---');
  console.log(text);
  console.log(`(poll: ${pollQuestion} — ${pollOptions.join(' / ')})`);
  process.exit(0);
}

async function call(method, payload) {
  const res = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  const json = await res.json();
  if (!json.ok) {
    console.error(`Telegram API error (${method}): ${json.error_code} ${json.description}`);
    process.exit(1);
  }
  return json.result;
}

const post = await call('sendMessage', {
  chat_id: TELEGRAM_CHAT_ID,
  text,
  parse_mode: 'HTML',
});
console.log(`✓ Post sent (message_id=${post.message_id}).`);

const poll = await call('sendPoll', {
  chat_id: TELEGRAM_CHAT_ID,
  question: pollQuestion,
  options: pollOptions,
});
console.log(`✓ Poll sent (message_id=${poll.message_id}).`);
