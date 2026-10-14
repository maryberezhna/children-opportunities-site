// Відгук одним натиском (Марія, 14.10.2026): перший натиск зберігається одразу,
// теги — необовʼязкові, на «⭐ Відгук» адмін відповідає реплаєм.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseFbData, fbRatingKeyboard, fbTagsKeyboard, fbAdminText, FB_PRODUCTS, handleFeedbackCallback } from '../lib/feedback.js';

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
      maybeSingle: async () => {
        if (table === 'olimpiada_entries') return { data: entry };
        return { data: rows.find((r) => r.entry_token === st.filters.entry_token) || null };
      },
      upsert: async (row) => { calls.push(['upsert', row]); rows.push({ id: 1, tags: [], ...row }); return {}; },
      update: (row) => { calls.push(['update', row]); return { eq: async () => ({}) }; },
    };
    return api;
  };
  return { from: q, calls, rows };
}

test('перший натиск: зберегли оцінку, сповістили адміна, показали теги', async () => {
  const sent = []; const admin = [];
  const bot = { answerCallback: async () => {}, editMessage: async (...a) => sent.push(a) };
  const db = fakeDb({ child_name: 'Даніїл', telegram_chat_id: '42' });
  const cbq = { id: 'x', data: `fb:r:ol:${TOKEN}:good`, message: { chat: { id: 42 }, message_id: 7 } };
  assert.equal(await handleFeedbackCallback(bot, cbq, { supabase: db, notifyAdmin: async (t) => admin.push(t) }), true);
  assert.equal(db.calls[0][1].rating, 'good');
  assert.equal(admin.length, 1);
  assert.match(sent[0][2], /Що саме\?/);
});

test('чужий чат не може залишити відгук за чужим токеном', async () => {
  const bot = { answerCallback: async () => {}, editMessage: async () => {} };
  const db = fakeDb({ child_name: 'Даніїл', telegram_chat_id: '42' });
  const cbq = { id: 'x', data: `fb:r:ol:${TOKEN}:bad`, message: { chat: { id: 99 }, message_id: 7 } };
  await handleFeedbackCallback(bot, cbq, { supabase: db });
  assert.equal(db.calls.length, 0);
});

test('питання йде після диплома; реплай працює на відгук і «пройшли тест»', () => {
  assert.match(read('lib/olimpiada-bot.js'), /fbRatingKeyboard\('ol', entry\.token\)/);
  const wh = read('app/api/telegram/webhook/route.js');
  assert.match(wh, /REPLYABLE_HEADS = \[FB_ADMIN_HEAD, '🧩 Олімпіада: пройшли тест'\]/);
  assert.match(read('app/api/olimpiada/submit/route.js'), /entry\.telegram_chat_id \? ` · \$\{esc\(String\(entry\.telegram_chat_id\)\)\}:`/);
  assert.match(read('app/admin/korystuvachi/page.js'), /product_feedback/);
});
