// Реєструє список команд бота — те саме меню «/» біля поля вводу в Telegram.
//
// Навіщо. Команди адмінки (/черга, /метрики, /звернення) вебхук розумів і
// раніше, але ніде не був написаний їхній перелік: щоб ними скористатись,
// треба було памʼятати слово напамʼять. Тепер Telegram сам показує список —
// адмінське меню видно в чаті з ботом, а звичайні користувачі бачать лише
// свої дві команди.
//
// Те саме для платного бота @DityamPlusBot: його команди, опис у профілі й
// текст на екрані до кнопки «Запустити» теж живуть тут, а не тільки в
// BotFather — щоб перелік у Telegram не розходився з тим, що вміє код
// (app/api/telegram/plus/route.js). Назву й Privacy Policy API не чіпає:
// назву Марія поставила сама, а політику можна вказати лише в BotFather.
//
// Запуск: TELEGRAM_BOT_TOKEN=… TELEGRAM_ADMIN_CHAT_ID=… node scripts/set-bot-commands.mjs
// ACTION=info — показати, що зараз зареєстровано.

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PLUS_TOKEN = process.env.TELEGRAM_PLUS_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const ACTION = process.env.ACTION || 'set';

if (!TOKEN) {
  console.error('Missing TELEGRAM_BOT_TOKEN');
  process.exit(1);
}

const TG = `https://api.telegram.org/bot${TOKEN}`;

async function call(method, body, token = TOKEN) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
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

const PLUS_COMMANDS = [
  { command: 'start', description: '🧡 Головне меню' },
  { command: 'new', description: '🔎 Свіжі можливості під профіль дитини' },
  { command: 'child', description: '➕ Додати ще одну дитину' },
  { command: 'form', description: '✏️ Заповнити анкету заново' },
  { command: 'profile', description: '⭐ Профіль дітей і деталі підписки' },
  { command: 'support', description: '📝 Допомога із заявкою' },
  { command: 'stop', description: '🚪 Відписатися і скасувати списання' },
];

// About у профілі бота (ліміт Telegram — 120 символів).
const PLUS_SHORT = 'Щодня добираємо можливості саме для вашої дитини й нагадуємо про дедлайни. Платформа Dityam.com.ua';

// Екран до кнопки «Запустити» (ліміт — 512 символів).
const PLUS_DESCRIPTION = `🧡 Dityam+ — підписка на можливості для вашої дитини.

Платформа Dityam.com.ua показує все, що існує. Dityam+ щодня добирає з цього те, що підходить саме вашій дитині — за віком, вподобаннями, форматом і містом.

• Нагадуємо про дедлайни, поки ще є час подати заявку
• Підкажемо, що заповнювати в анкеті
• Свіжі можливості на вимогу, будь-коли
• Усе приходить сюди, у Telegram

Натисніть «Запустити» 👇`;

async function plusProfile() {
  if (!PLUS_TOKEN) {
    console.warn('TELEGRAM_PLUS_BOT_TOKEN не заданий — платний бот без змін.');
    return true;
  }
  if (ACTION === 'info') {
    const cur = await call('getMyCommands', { scope: { type: 'default' } }, PLUS_TOKEN);
    const short = await call('getMyShortDescription', undefined, PLUS_TOKEN);
    const desc = await call('getMyDescription', undefined, PLUS_TOKEN);
    console.log('plus commands:', JSON.stringify(cur.result, null, 2));
    console.log('plus about:', short.result?.short_description);
    console.log('plus description:', desc.result?.description);
    return true;
  }
  if (PLUS_SHORT.length > 120) throw new Error(`About задовгий: ${PLUS_SHORT.length}`);
  if (PLUS_DESCRIPTION.length > 512) throw new Error(`Description задовгий: ${PLUS_DESCRIPTION.length}`);
  const cmds = await call('setMyCommands', { commands: PLUS_COMMANDS, scope: { type: 'default' } }, PLUS_TOKEN);
  const short = await call('setMyShortDescription', { short_description: PLUS_SHORT }, PLUS_TOKEN);
  const desc = await call('setMyDescription', { description: PLUS_DESCRIPTION }, PLUS_TOKEN);
  console.log(`платний бот: команди ${cmds.ok ? '✅' : '✗'}, About ${short.ok ? '✅' : '✗'}, опис ${desc.ok ? '✅' : '✗'}`);
  return cmds.ok && short.ok && desc.ok;
}

if (ACTION === 'info') {
  const def = await call('getMyCommands', { scope: { type: 'default' } });
  console.log('default:', JSON.stringify(def.result, null, 2));
  if (ADMIN_CHAT_ID) {
    const adm = await call('getMyCommands', { scope: { type: 'chat', chat_id: ADMIN_CHAT_ID } });
    console.log('admin chat:', JSON.stringify(adm.result, null, 2));
  }
  await plusProfile();
  process.exit(0);
}

const pub = await call('setMyCommands', {
  commands: PUBLIC_COMMANDS,
  scope: { type: 'default' },
});
console.log(`публічні команди: ${pub.ok ? '✅' : '✗'}`);

const plusOk = await plusProfile();

if (!ADMIN_CHAT_ID) {
  console.warn('TELEGRAM_ADMIN_CHAT_ID не заданий — адмінські команди не реєструю.');
  process.exit(pub.ok && plusOk ? 0 : 1);
}

const adm = await call('setMyCommands', {
  commands: ADMIN_COMMANDS,
  scope: { type: 'chat', chat_id: ADMIN_CHAT_ID },
});
console.log(`адмінські команди: ${adm.ok ? '✅' : '✗'}`);

process.exit(pub.ok && adm.ok && plusOk ? 0 : 1);
