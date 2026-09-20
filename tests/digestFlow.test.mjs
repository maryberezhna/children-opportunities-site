import test from 'node:test';
import assert from 'node:assert/strict';
import {
  beginFlow, beginFreq, handleFlowCallback,
  toggleReminders, remindersOn, remindersLabel,
} from '../lib/digestFlow.js';

/**
 * Анкета Dityam+ від «скількох дітей» до «вартості».
 *
 * Навіщо тест. Флоу живе лише в Telegram, у проді його не пройшла жодна
 * людина (19.09.2026: 0 профілів дітей у базі), а зламана послідовність для
 * платника означає: гроші взяли, анкета зациклилась. Тут — підроблені Supabase
 * і бот, щоб перевірити саму послідовність кроків і те, що для кожної дитини
 * створюється свій профіль.
 */

// ── Підроблений Supabase: рівно ті виклики, які робить lib/digestFlow.js ──
function fakeDb() {
  const rows = { digest_subscribers: [], plus_children: [], opportunities: [] };
  let seq = 0;
  const match = (row, filters) => filters.every(([col, val]) => (
    val === null ? row[col] === null || row[col] === undefined : String(row[col]) === String(val)
  ));
  const table = (name) => {
    const state = { filters: [], patch: null, op: 'select', inserted: [] };
    const api = {
      select() { return api; },
      eq(col, val) { state.filters.push([col, val]); return api; },
      is(col, val) { state.filters.push([col, val]); return api; },
      order() { return api; },
      range() { return api; },
      insert(payload) {
        state.op = 'insert';
        const list = Array.isArray(payload) ? payload : [payload];
        state.inserted = list.map((r) => {
          seq += 1;
          const row = { id: `${name}-${seq}`, ...r };
          rows[name].push(row);
          return row;
        });
        return api;
      },
      update(patch) { state.op = 'update'; state.patch = patch; return api; },
      delete() { state.op = 'delete'; return api; },
      maybeSingle() { return Promise.resolve({ data: api._rows()[0] || null }); },
      single() { return Promise.resolve({ data: api._rows()[0] || null }); },
      _rows() {
        if (state.op === 'insert') return state.inserted;
        return rows[name].filter((r) => match(r, state.filters));
      },
      then(resolve) {
        const found = rows[name].filter((r) => match(r, state.filters));
        if (state.op === 'update') found.forEach((r) => Object.assign(r, state.patch));
        if (state.op === 'delete') {
          for (const r of found) rows[name].splice(rows[name].indexOf(r), 1);
        }
        return Promise.resolve(resolve({ data: api._rows(), error: null }));
      },
    };
    return api;
  };
  return { from: table, _rows: rows };
}

// ── Підроблений бот: збирає, що показали користувачу ──
function fakeBot() {
  const sent = [];
  return {
    sent,
    last: () => sent[sent.length - 1],
    sendMessage: (chatId, text, markup) => { sent.push({ kind: 'send', text, markup }); },
    editMessage: (chatId, id, text, markup) => { sent.push({ kind: 'edit', text, markup }); },
    answerCallback: () => {},
  };
}

const buttons = (msg) => (msg?.markup?.inline_keyboard || []).flat().map((b) => b.callback_data);
const click = (data) => ({ id: 'cb', data, message: { chat: { id: '77' }, message_id: 1 } });

async function setup() {
  const db = fakeDb();
  db._rows.digest_subscribers.push({
    id: 'sub-1', telegram_chat_id: '77', status: 'pending', places: [], consent_at: null,
  });
  const bot = fakeBot();
  await beginFlow(bot, db, '77', null);
  return { db, bot };
}

test('анкета: спершу питаємо, для скількох дітей', async () => {
  const { db, bot } = await setup();
  assert.match(bot.sent[0].text, /кожну дитину окремо/);
  assert.match(bot.last().text, /Для скількох дітей/);
  assert.deepEqual(buttons(bot.last()), [1, 2, 3, 4, 5, 6].map((n) => `flow:count:${n}`));
  assert.equal(db._rows.digest_subscribers[0].flow_step, 'count');
  // Профілі дітей ще не створені: спершу відповідь про кількість.
  assert.equal(db._rows.plus_children.length, 0);
});

test('анкета: вік — один діапазон, і він одразу веде далі', async () => {
  const { db, bot } = await setup();
  await handleFlowCallback(bot, db, click('flow:count:1'));
  assert.match(bot.last().text, /Скільки років дитині/);
  // Кнопки віку без «Далі»: вибір одразу зараховується.
  assert.deepEqual(buttons(bot.last()).at(-1), 'flow:age:15-18');

  await handleFlowCallback(bot, db, click('flow:age:7-10'));
  assert.deepEqual(db._rows.plus_children[0].age_bands, ['7-10']);
  assert.match(bot.last().text, /Що подобається дитині/);
});

test('анкета: двоє дітей — профіль кожної по черзі, потім спільні питання', async () => {
  const { db, bot } = await setup();
  await handleFlowCallback(bot, db, click('flow:count:2'));
  assert.equal(db._rows.plus_children.length, 2);
  assert.match(bot.last().text, /Дитина 1 з 2/);

  // Перша дитина: вік → теми → формат → обставини.
  await handleFlowCallback(bot, db, click('flow:age:4-6'));
  await handleFlowCallback(bot, db, click('flow:like:__done'));
  await handleFlowCallback(bot, db, click('flow:fmt:__done'));
  await handleFlowCallback(bot, db, click('flow:need:__done'));

  // Далі не «Є ще діти?», а одразу друга дитина.
  assert.match(bot.last().text, /Дитина 2 з 2.*Скільки років/s);
  assert.equal(db._rows.digest_subscribers[0].flow_child_id, db._rows.plus_children[1].id);

  await handleFlowCallback(bot, db, click('flow:age:15-18'));
  await handleFlowCallback(bot, db, click('flow:like:__done'));
  await handleFlowCallback(bot, db, click('flow:fmt:__done'));
  await handleFlowCallback(bot, db, click('flow:need:__done'));

  // Обидві дитини заповнені — питання про місце одне на родину.
  assert.match(bot.last().text, /Де шукати можливості/);
  assert.equal(db._rows.digest_subscribers[0].flow_step, 'place');
  assert.deepEqual(db._rows.plus_children.map((c) => c.age_bands), [['4-6'], ['15-18']]);

  const done = await handleFlowCallback(bot, db, click('flow:place:__done'));
  assert.equal(done.finished, false);
  assert.match(bot.last().text, /платні можливості чи лише безкоштовні/);

  // Останнє питання — частота добірки; анкета завершується саме на ньому.
  const cost = await handleFlowCallback(bot, db, click('flow:cost:free_only'));
  assert.equal(cost.finished, false);
  assert.equal(db._rows.digest_subscribers[0].cost_pref, 'free_only');
  assert.match(bot.last().text, /Як часто надсилати добірку/);

  const finished = await handleFlowCallback(bot, db, click('flow:freq:weekly'));
  assert.equal(finished.finished, true);
  assert.equal(db._rows.digest_subscribers[0].digest_freq, 'weekly');
  assert.equal(db._rows.digest_subscribers[0].flow_step, null);
});

test('частота: зміна з меню не видає «Профіль готовий»', async () => {
  const { db, bot } = await setup();
  db._rows.digest_subscribers[0].status = 'active';
  await beginFreq(bot, db, '77');
  assert.match(bot.last().text, /Як часто надсилати добірку/);
  const res = await handleFlowCallback(bot, db, click('flow:freq:2days'));
  assert.equal(res.finished, false);
  assert.equal(db._rows.digest_subscribers[0].digest_freq, '2days');
  assert.equal(db._rows.digest_subscribers[0].flow_mode, null);
});

test('анкета: кнопка зі старого кроку не збиває послідовність', async () => {
  const { db, bot } = await setup();
  await handleFlowCallback(bot, db, click('flow:count:1'));
  const before = db._rows.digest_subscribers[0].flow_step;
  await handleFlowCallback(bot, db, click('flow:count:3'));
  assert.equal(db._rows.digest_subscribers[0].flow_step, before);
  assert.equal(db._rows.plus_children.length, 1);
});

/**
 * Нагадування про дедлайни — вибір підписника, а не наша обіцянка «завжди».
 * Родина, яка стежить за подачею сама, має змогу їх вимкнути, не відписуючись
 * від Dityam+ цілком. Дзеркало в Python: scraper/deadline_reminders.reminders_on.
 */
test('нагадування: увімкнені, поки людина не сказала інакше', () => {
  assert.equal(remindersOn({}), true);
  assert.equal(remindersOn({ deadline_reminders: null }), true);
  assert.equal(remindersOn({ deadline_reminders: true }), true);
  assert.equal(remindersOn({ deadline_reminders: false }), false);
  assert.match(remindersLabel({}), /увімкнені/);
  assert.match(remindersLabel({ deadline_reminders: false }), /вимкнені/);
});

test('нагадування: кнопка меню перемикає стан і зберігає його', async () => {
  const db = fakeDb();
  db._rows.digest_subscribers.push({
    id: 'sub-1', telegram_chat_id: '77', status: 'active', deadline_reminders: true,
  });

  assert.equal(await toggleReminders(db, '77'), false);
  assert.equal(db._rows.digest_subscribers[0].deadline_reminders, false);

  assert.equal(await toggleReminders(db, '77'), true);
  assert.equal(db._rows.digest_subscribers[0].deadline_reminders, true);
});

test('нагадування: чужий чат нічого не перемикає', async () => {
  const db = fakeDb();
  assert.equal(await toggleReminders(db, '404'), null);
});
