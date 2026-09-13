// Реєструє список команд бота — те саме меню «/» біля поля вводу в Telegram.
//
// Навіщо. Команди адмінки (/черга, /метрики, /звернення) вебхук розумів і
// раніше, але ніде не був написаний їхній перелік: щоб ними скористатись,
// треба було памʼятати слово напамʼять. Тепер Telegram сам показує список —
// адмінське меню видно в чаті з ботом, а звичайні користувачі бачать лише
// свої дві команди.
//
// Запуск: TELEGRAM_BOT_TOKEN=… TELEGRAM_ADMIN_CHAT_ID=… node scripts/set-bot-commands.mjs
// ACTION=info — показати, що зараз зареєстровано.

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const ACTION = process.env.ACTION || 'set';

if (!TOKEN) {
  console.error('Missing TELEGRAM_BOT_TOKEN');
  process.exit(1);
}

const TG = `https://api.telegram.org/bot${TOKEN}`;

async function call(method, body) {
  const res = await fetch(`${TG}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!json.ok) console.error(`${method}: ${json.description}`);
  return json;
}

// Для всіх: бот приватно веде підписку на підбірку, більше йому нічого не треба.
const PUBLIC_COMMANDS = [
  { command: 'start', description: 'Почати' },
  { command: 'stop', description: 'Відписатись від підбірки' },
];

// Для адмін-чату: те саме, що є сторінками в /admin.
//
// Назви лише латиницею: Telegram приймає в setMyCommands тільки
// [a-z0-9_], тож «/черга» у меню зареєструвати не можна. Сам вебхук
// українські слова розуміє й далі — надруковане руками «/черга» працює,
// у списку просто стоїть латинський аліас із українським описом.
const ADMIN_COMMANDS = [
  { command: 'menu', description: '🛠 Меню адмінки' },
  { command: 'queue', description: '🗂 Черга: наступний кандидат на апрув' },
  { command: 'stats', description: '📈 Метрики: сайт, черга, Dityam+' },
  { command: 'messages', description: '✉️ Нові звернення й пропозиції' },
];

if (ACTION === 'info') {
  const def = await call('getMyCommands', { scope: { type: 'default' } });
  console.log('default:', JSON.stringify(def.result, null, 2));
  if (ADMIN_CHAT_ID) {
    const adm = await call('getMyCommands', { scope: { type: 'chat', chat_id: ADMIN_CHAT_ID } });
    console.log('admin chat:', JSON.stringify(adm.result, null, 2));
  }
  process.exit(0);
}

const pub = await call('setMyCommands', {
  commands: PUBLIC_COMMANDS,
  scope: { type: 'default' },
});
console.log(`публічні команди: ${pub.ok ? '✅' : '✗'}`);

if (!ADMIN_CHAT_ID) {
  console.warn('TELEGRAM_ADMIN_CHAT_ID не заданий — адмінські команди не реєструю.');
  process.exit(pub.ok ? 0 : 1);
}

const adm = await call('setMyCommands', {
  commands: ADMIN_COMMANDS,
  scope: { type: 'chat', chat_id: ADMIN_CHAT_ID },
});
console.log(`адмінські команди: ${adm.ok ? '✅' : '✗'}`);

process.exit(pub.ok && adm.ok ? 0 : 1);
