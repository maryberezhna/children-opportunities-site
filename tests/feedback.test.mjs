// Відгук одним натиском (Марія, 14.10.2026): перший натиск зберігається одразу,
// теги — необовʼязкові, на «⭐ Відгук» адмін відповідає реплаєм.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseFbData, fbRatingKeyboard, fbTagsKeyboard, fbAdminText, FB_PRODUCTS,
  handleFeedbackCallback, handleFeedbackReply, FB_DETAILS_HEAD, FB_DETAILS_PROMPT, fbTagsText,
} from '../lib/feedback.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const TOKEN = 'a'.repeat(32);

test('кнопки влазять у callback_data і розбираються назад', () => {
  for (const row of [...fbRatingKeyboard('ol', TOKEN), ...fbTagsKeyboard('ol', TOKEN)]) {
    for (const b of row) {
      assert.ok(Buffer.byteLength(b.callback_data, 'utf8') <= 64, b.callback_data);
      assert.ok(parseFbData(b.callback_data), b.callback_data);
    }
  }
  assert.equal(parseFbData('fb:r:ol:not-a-token:good'), null);
  assert.equal(parseFbData(`fb:r:ol:${TOKEN}:wow`), null);
  assert.equal(parseFbData(`fb:r:xx:${TOKEN}:good`), null);
});

test('сповіщення адміну закінчує перший рядок chat id — для реплаю', () => {
  const t = fbAdminText({ product: FB_PRODUCTS.ol, childName: 'Даніїл', rating: 'meh', chatId: '792843393' });
  assert.match(t.split('\n')[0], /(-?\d+):\s*$/);
  assert.ok(t.startsWith('⭐ Відгук'));
});

function fakeDb(entry, rows = []) {
  const calls = [];
  const q = (table) => {
    const st = { table, filters: {} };
    const api = {
      select: () => api,
      eq: (k, v) => { st.filters[k] = v; return api; },
      order: () => api,
      limit: () => api,
      maybeSingle: async () => {
        if (table === 'olimpiada_entries') return { data: entry };
        if (st.filters.entry_token) return { data: rows.find((r) => r.entry_token === st.filters.entry_token) || null };
        return { data: rows.find((r) => r.telegram_chat_id === st.filters.telegram_chat_id) || null };
      },
      upsert: async (row) => { calls.push(['upsert', row]); rows.push({ id: 1, tags: [], ...row }); return {}; },
      update: (row) => { calls.push(['update', row]); return { eq: async () => ({}) }; },
    };
    return api;
  };
  return { from: q, calls, rows };
}

function fakeBot() {
  const edits = []; const messages = [];
  return {
    edits,
    messages,
    answerCallback: async () => {},
    editMessage: async (...a) => edits.push(a),
    sendMessage: async (...a) => messages.push(a),
  };
}

test('перший натиск: зберегли оцінку, сповістили адміна, показали теги і поле «детальніше»', async () => {
  const admin = [];
  const bot = fakeBot();
  const db = fakeDb({ child_name: 'Даніїл', telegram_chat_id: '42' });
  const cbq = { id: 'x', data: `fb:r:ol:${TOKEN}:good`, message: { chat: { id: 42 }, message_id: 7 } };
  assert.equal(await handleFeedbackCallback(bot, cbq, { supabase: db, notifyAdmin: async (t) => admin.push(t) }), true);
  assert.equal(db.calls[0][1].rating, 'good');
  assert.equal(admin.length, 1);
  assert.match(bot.edits[0][2], /Що саме\?/);
  // В тексті бота емодзі показуються кодом — підпис оцінки без емодзі.
  assert.match(bot.edits[0][2], /Дякуємо, записали: Сподобалось\./);
  // force_reply відкриває людині поле відповіді одразу (14.10.2026).
  assert.equal(bot.messages.length, 1);
  assert.equal(bot.messages[0][1], FB_DETAILS_PROMPT);
  assert.equal(bot.messages[0][2].force_reply, true);
});

test('зміна оцінки вдруге не шле ще одне «поділіться детальніше»', async () => {
  const bot = fakeBot();
  const rows = [{ id: 1, product: 'olimpiada', entry_token: TOKEN, telegram_chat_id: '42', tags: [] }];
  const db = fakeDb({ child_name: 'Даніїл', telegram_chat_id: '42' }, rows);
  const cbq = { id: 'x', data: `fb:r:ol:${TOKEN}:meh`, message: { chat: { id: 42 }, message_id: 7 } };
  await handleFeedbackCallback(bot, cbq, { supabase: db });
  assert.equal(bot.messages.length, 0);
});

test('чужий чат не може залишити відгук за чужим токеном', async () => {
  const bot = fakeBot();
  const db = fakeDb({ child_name: 'Даніїл', telegram_chat_id: '42' });
  const cbq = { id: 'x', data: `fb:r:ol:${TOKEN}:bad`, message: { chat: { id: 99 }, message_id: 7 } };
  await handleFeedbackCallback(bot, cbq, { supabase: db });
  assert.equal(db.calls.length, 0);
});

test('відповідь на «поділіться детальніше»: note збережено, адміну реплайний заголовок', async () => {
  const admin = [];
  const bot = fakeBot();
  const rows = [{ id: 1, product: 'olimpiada', entry_token: TOKEN, telegram_chat_id: '42', child_name: 'Даніїл', note: null }];
  const db = fakeDb(null, rows);
  const msg = { chat: { id: 42 }, text: 'Все сподобалось, дякуємо!', reply_to_message: { text: FB_DETAILS_PROMPT } };
  assert.equal(await handleFeedbackReply(bot, msg, { supabase: db, notifyAdmin: async (t) => admin.push(t) }), true);
  const upd = db.calls.find(([op]) => op === 'update');
  assert.match(upd[1].note, /Все сподобалось/);
  assert.match(bot.messages[0][1], /Дякуємо, записали/);
  // Перший рядок сповіщення закінчується chat id — за ним іде реплай людині.
  assert.match(admin[0].split('\n')[0], /(-?\d+):\s*$/);
  assert.ok(admin[0].startsWith('⭐ Відгук'));
});

test('чужий реплай (не на наше прохання) відгуком не вважається', async () => {
  const bot = fakeBot();
  const msg = { chat: { id: 42 }, text: 'Даніїл', reply_to_message: { text: 'Як звати дитину?' } };
  assert.equal(await handleFeedbackReply(bot, msg, { supabase: fakeDb(null) }), false);
  assert.equal(bot.messages.length, 0);
});

test('підпис оцінки в тексті — без емодзі, промпт починається з упізнаваного початку', () => {
  assert.equal(fbTagsText('meh').includes('😐'), false);
  assert.ok(FB_DETAILS_PROMPT.startsWith(FB_DETAILS_HEAD));
});

test('питання йде після диплома; реплай працює на відгук і «пройшли тест»', () => {
  assert.match(read('lib/olimpiada-bot.js'), /fbRatingKeyboard\('ol', entry\.token\)/);
  const wh = read('app/api/telegram/webhook/route.js');
  assert.match(wh, /REPLYABLE_HEADS = \[FB_ADMIN_HEAD, '🧩 Олімпіада: пройшли тест'\]/);
  assert.match(read('app/api/olimpiada/submit/route.js'), /entry\.telegram_chat_id \? ` · \$\{esc\(String\(entry\.telegram_chat_id\)\)\}:`/);
  assert.match(read('app/admin/korystuvachi/page.js'), /product_feedback/);
});
