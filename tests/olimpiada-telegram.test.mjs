// Олімпіада з логіки через Telegram (Марія, 13.10.2026: «щоб в телеграм боті
// можна було пройти безкоштовну олімпіаду… бо з імейлами проблема, перенеси
// все туди»).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(f, 'utf8');
const { olStartArg, teacherFromPrompt, OL_NAME_PROMPT, handleOlCallback, sendOlIntro } = await import('../lib/olimpiada-bot.js');

test('посилання з сайту: start=olimp і start=olimp_<код педагога>', () => {
  assert.deepEqual(olStartArg('olimp'), { teacher: null });
  assert.equal(olStartArg('from_olimpiada'), null);
  assert.equal(olStartArg('promo_first'), null);
  assert.equal(olStartArg('olimp_!!'), null);
});

test('бот: згода → імʼя через force_reply, код класу передається в підказці', async () => {
  const sent = [];
  const bot = { sendMessage: async (c, t, m) => sent.push({ t, m }), answerCallback: async () => {} };
  await sendOlIntro(bot, '1');
  assert.match(sent[0].t, /правилами олімпіади/);
  assert.equal(sent[0].m.inline_keyboard[0][0].callback_data, 'ol:start');
  await handleOlCallback(bot, { id: 'x', data: 'ol:start', message: { chat: { id: 1 } } });
  assert.ok(sent[1].t.startsWith(OL_NAME_PROMPT));
  assert.equal(sent[1].m.force_reply, true);
  assert.equal(teacherFromPrompt(`${OL_NAME_PROMPT}\nКод класу: зовсім-не-код`), null);
});

test('сайт: «Взяти участь» веде в бот, а не у форму з поштою', () => {
  const page = read('app/olimpiada/page.js');
  assert.match(page, /<TelegramJoin \/>/);
  assert.doesNotMatch(page, /<EntryForm /);
  assert.doesNotMatch(page, /прийде ще й на email|прийде на ваш email|надходить посилання на нього/);
  assert.match(read('app/olimpiada/TelegramJoin.js'), /start=olimp/);
});

test('після тесту диплом іде в Telegram; бот і /olymp — без підписки', () => {
  assert.match(read('app/api/olimpiada/submit/route.js'), /if \(entry\.telegram_chat_id\) await sendOlDiploma/);
  const route = read('app/api/telegram/plus/route.js');
  assert.match(route, /olStartArg\(startArg\)/);
  assert.match(route, /handleOlCallback\(bot, cbq/);
  assert.match(route, /handleOlReply\(bot, msg/);
  assert.ok(route.indexOf("if (cmd === 'olymp')") < route.indexOf('if (cmd && SUB_COMMANDS.has(cmd))'), '/olymp не має вимагати підписки');
  // Текст повідомлень — без емодзі, які Telegram показує кодом.
  for (const l of read('lib/olimpiada-bot.js').split('\n').filter((x) => !x.includes('text:') && !x.trim().startsWith('//'))) {
    assert.doesNotMatch(l, /[\u{1F300}-\u{1F3FF}]/u, l.trim());
  }
});

test('реєструють батьки чи вчитель: на сайті й у боті; ліміт — на дитину, а не на чат (13.10.2026)', () => {
  assert.match(read('app/olimpiada/page.js'), /Дитину реєструють батьки чи вчитель/);
  assert.match(read('app/olimpiada/TelegramJoin.js'), /Батьки чи вчитель/);
  const bot = read('lib/olimpiada-bot.js');
  assert.match(bot, /Дитину записують батьки чи вчитель/);
  assert.match(bot, /sameName\.length >= OLIMP\.maxEntriesPerEmail/);
  assert.match(bot, /maxEntriesPerTeacherDay/);
});

// 21.10.2026: вчителька записала першу дитину за своїм посиланням, а решту —
// кнопкою «Записати ще» і просто іменем; код класу губився, і діти не
// зараховувались до її класу. Тепер код береться від попередньої дитини чату.
test('код класу успадковується від останньої дитини з кодом у цьому чаті', async () => {
  const { lastTeacherCode } = await import('../lib/olimpiada-bot.js');
  assert.equal(lastTeacherCode([]), null);
  assert.equal(lastTeacherCode([{ teacher_code: null }]), null);
  assert.equal(lastTeacherCode([{ teacher_code: 'hzsem59c' }, { teacher_code: null }]), 'hzsem59c');
  assert.equal(lastTeacherCode([{ teacher_code: 'aaaa1111' }, { teacher_code: 'hzsem59c' }, { teacher_code: null }]), 'hzsem59c');
  assert.equal(lastTeacherCode([{ teacher_code: 'зовсім-не-код' }]), null);
});
