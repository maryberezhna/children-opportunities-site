// Анонс контактної форми: окремий пост у канал + акуратне доповнення
// закріпленого поста про проєкт (щоб закріп лишався поясненням «що це таке»,
// але вів і на форму).
//
// Закріплений пост редагуємо через editMessageText з ПЕРЕДАЧЕЮ оригінальних
// entities: сире поле `text` не містить розмітки, тож без entities жирний
// шрифт і лінки в старому тексті просто зникли б. Ми дописуємо в КІНЕЦЬ, тому
// офсети наявних entities лишаються чинними.
//
// Запуск: .github/workflows/contact-form-post.yml (workflow_dispatch).
//   DRY_RUN=true — лише показати, що буде зроблено (і що зараз у закріпі).

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const DRY_RUN = process.env.DRY_RUN === 'true';
const SKIP_PINNED = process.env.SKIP_PINNED === 'true';

if (!TOKEN || !CHAT_ID) {
  console.error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
  process.exit(1);
}

const api = async (method, body) => {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
};

const POST = [
  '📬 <b>Тепер нам можна написати прямо з сайту</b>',
  '',
  'Ми зробили просту форму — <a href="https://dityam.com.ua/contacts">dityam.com.ua/contacts</a>.',
  'Обираєте тему, пишете кілька слів, і лист одразу падає нам у роботу:',
  '',
  '💡 <b>Запропонувати можливість</b> — знаєте гурток, табір чи конкурс, якого немає в каталозі? Ми перевіримо й додамо.',
  '',
  '🐛 <b>Помилка в даних</b> — прострочена програма, битий лінк, неправильний вік. Пишіть, виправимо швидко.',
  '',
  '⚠️ <b>Скарга</b> — якщо «безкоштовна» програма виявилась платною або не тим, що обіцяли. Для нас це важливо: ми прибираємо такі з каталогу.',
  '',
  '🤝 <b>Співпраця</b> — для організацій, фондів і шкіл.',
  '',
  '📰 <b>Медіа</b> — інтервʼю, коментар, дані.',
  '',
  '💬 <b>Інше</b> — питання, ідея або просто привітатися 🧡',
  '',
  '👉 <a href="https://dityam.com.ua/contacts">dityam.com.ua/contacts</a>',
].join('\n');

// Дописуємо в кінець закріпленого. Без HTML: текст іде разом зі старими
// entities, а свої посилання додаємо власними entity-обʼєктами нижче.
const APPEND = '\n\n📬 А ще тепер нам можна написати прямо з сайту — форма на dityam.com.ua/contacts: запропонувати можливість, повідомити про помилку чи просто привітатися 🧡';

async function main() {
  // 1. Що зараз у закріпі
  const chat = await api('getChat', { chat_id: CHAT_ID });
  if (!chat.ok) {
    console.error(`getChat failed: ${chat.error_code} ${chat.description}`);
    process.exit(1);
  }
  const pinned = chat.result.pinned_message;

  console.log('--- Закріплений пост ---');
  if (!pinned) {
    console.log('(немає закріпленого поста)');
  } else {
    console.log(`message_id=${pinned.message_id}, від бота: ${Boolean(pinned.from?.is_bot)}`);
    console.log(`entities: ${(pinned.entities || []).length}`);
    console.log('текст:\n' + (pinned.text || pinned.caption || '(без тексту)'));
  }
  console.log('--- /Закріплений пост ---\n');

  if (DRY_RUN) {
    console.log('--- DRY RUN: новий пост ---');
    console.log(POST);
    console.log('\n--- DRY RUN: доповнення до закріпленого ---');
    console.log(APPEND.trim());
    return;
  }

  // 2. Новий пост у канал
  const sent = await api('sendMessage', {
    chat_id: CHAT_ID,
    text: POST,
    parse_mode: 'HTML',
    disable_web_page_preview: false,
  });
  if (!sent.ok) {
    console.error(`sendMessage failed: ${sent.error_code} ${sent.description}`);
    process.exit(1);
  }
  console.log(`✓ Пост опубліковано (message_id=${sent.result.message_id}).`);

  if (SKIP_PINNED) {
    console.log('SKIP_PINNED=true — закріплений пост не чіпаємо.');
    return;
  }

  // 3. Доповнення закріпленого
  if (!pinned) {
    console.log('Закріпленого поста немає — нічого доповнювати.');
    return;
  }
  const oldText = pinned.text;
  if (!oldText) {
    console.log('Закріплений пост без текстового поля (фото/медіа) — не чіпаємо.');
    return;
  }

  // Своє посилання додаємо окремою entity, щоб не переписувати старий текст
  // у HTML і не втратити наявне форматування.
  const linkOffset = [...oldText].length + [...APPEND].indexOf('dityam.com.ua/contacts');
  const entities = [
    ...(pinned.entities || []),
    { type: 'url', offset: linkOffset, length: 'dityam.com.ua/contacts'.length },
  ];

  const edited = await api('editMessageText', {
    chat_id: CHAT_ID,
    message_id: pinned.message_id,
    text: oldText + APPEND,
    entities,
    disable_web_page_preview: true,
  });

  if (!edited.ok) {
    // Найчастіша причина — пост писав не наш бот: чужі пости редагувати не можна.
    console.error(`⚠️ Закріплений пост не оновлено: ${edited.error_code} ${edited.description}`);
    console.error('Новий пост при цьому опубліковано — допишіть абзац у закріп вручну.');
    return;
  }
  console.log('✓ Закріплений пост доповнено абзацом про форму.');
}

await main();
