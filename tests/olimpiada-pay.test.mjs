// Оплата олімпіади без подвійних платежів і запрошення одразу (07.10.2026).
// Регресії, проти яких стоїть тест:
// - сторінка очікування штовхала до нової заявки, поки оплата ще йшла, —
//   батьки могли заплатити двічі; тепер сайт сам питає WayForPay (CHECK_STATUS);
// - «Order Not Found» WayForPay подає як Declined — це «платити не починали»,
//   а не «оплата не пройшла»;
// - колбек і звірка на сторінці в ту саму мить: подарунок, лист і
//   повідомлення в адмінку — лише 1 раз;
// - запрошення сайту й запасного скрипта — той самий текст.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';

process.env.WAYFORPAY_MERCHANT_ACCOUNT = 'test_merchant';
process.env.WAYFORPAY_SECRET_KEY = 'test_secret';
delete process.env.DITYAM_GMAIL_APP_PASSWORD;
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.TELEGRAM_BOT_TOKEN;

const { checkStatus, checkStatusBody } = await import('../lib/wayforpay.js');
const { syncPayment, syncPrint, markPaid, payFailed } = await import('../lib/olimpiada-server.js');
const { buildInvite, sendInvite } = await import('../lib/olimpiada-mail.js');

const md5 = (parts) => crypto.createHmac('md5', 'test_secret').update(parts.join(';'), 'utf8').digest('hex');
const signed = (o) => ({
  merchantAccount: 'test_merchant', currency: 'UAH', authCode: '', cardPan: '', ...o,
  merchantSignature: md5(['test_merchant', o.orderReference, String(o.amount), 'UAH', o.authCode || '', o.cardPan || '', o.transactionStatus, String(o.reasonCode)]),
});
// Що «відповідає» WayForPay на CHECK_STATUS у цьому тесті.
let wfp = () => ({});
globalThis.fetch = async (url, init) => {
  assert.equal(url, 'https://api.wayforpay.com/api');
  const body = JSON.parse(init.body);
  return { json: async () => wfp(body) };
};

const TOKEN = 'a'.repeat(32);
const REF = `olimp-${TOKEN}-1`;

function fakeStore(row) {
  const calls = { gift: 0 };
  const state = { ...row };
  return {
    calls, state, dev: false,
    async get() { return { ...state }; },
    async update(t, patch) { Object.assign(state, patch); return { ...state }; },
    async claim(t, field, patch) {
      // Як у базі: оновлюється лише там, де поле ще порожнє.
      await new Promise((r) => setTimeout(r, 1));
      if (state[field]) return null;
      Object.assign(state, patch);
      return { ...state };
    },
    async createGift() { calls.gift += 1; return 'g'.repeat(32); },
  };
}
const unpaid = () => ({ token: TOKEN, child_name: 'Марк', parent_email: 'mama@example.com', amount: 150, wfp_order_reference: REF });

test('CHECK_STATUS підписано merchantAccount;orderReference', () => {
  const b = checkStatusBody(REF);
  assert.equal(b.transactionType, 'CHECK_STATUS');
  assert.equal(b.merchantSignature, md5(['test_merchant', REF]));
});

test('відповідь WayForPay: довіряємо лише підписаній; Order Not Found — «не знає»', async () => {
  wfp = () => signed({ orderReference: REF, amount: 150, transactionStatus: 'Approved', reasonCode: 1100 });
  assert.equal((await checkStatus(REF)).status, 'Approved');
  wfp = () => ({ ...signed({ orderReference: REF, amount: 150, transactionStatus: 'Approved', reasonCode: 1100 }), merchantSignature: 'підробка' });
  assert.equal((await checkStatus(REF)).error, 'bad_signature');
  // Наживо 07.10.2026: невідоме замовлення — Declined з reasonCode 1127.
  wfp = () => signed({ orderReference: REF, amount: '', transactionStatus: 'Declined', reasonCode: 1127 });
  assert.equal((await checkStatus(REF)).status, null);
  // Покинута сторінка оплати — Expired, 1124.
  wfp = () => signed({ orderReference: REF, amount: 150, transactionStatus: 'Expired', reasonCode: 1124 });
  assert.equal((await checkStatus(REF)).status, 'Expired');
});

test('нову оплату пропонуємо лише після Declined чи Expired', () => {
  assert.ok(payFailed('Declined'));
  assert.ok(payFailed('Expired'));
  for (const s of ['InProcessing', 'Pending', 'WaitingAuthComplete', 'Approved', null, '']) assert.ok(!payFailed(s), s);
});

test('звірка на сторінці: оплачено — тест відкривається без колбека', async () => {
  wfp = () => signed({ orderReference: REF, amount: 150, transactionStatus: 'Approved', reasonCode: 1100 });
  const store = fakeStore(unpaid());
  const r = await syncPayment(store, await store.get());
  assert.equal(r.state, 'paid');
  assert.ok(store.state.paid_at);
  assert.equal(store.state.wfp_last_status, 'Approved');
  assert.equal(store.calls.gift, 1);
});

test('звірка: в процесі — чекаємо; не пройшла — можна ще раз; не починали — можна оплатити', async () => {
  const cases = [
    [{ transactionStatus: 'InProcessing', reasonCode: 1100, amount: 150 }, 'pending'],
    [{ transactionStatus: 'Expired', reasonCode: 1124, amount: 150 }, 'failed'],
    [{ transactionStatus: 'Declined', reasonCode: 1127, amount: '' }, 'none'],
  ];
  for (const [resp, want] of cases) {
    wfp = () => signed({ orderReference: REF, ...resp });
    const store = fakeStore(unpaid());
    const r = await syncPayment(store, await store.get());
    assert.equal(r.state, want, resp.transactionStatus);
    assert.ok(!store.state.paid_at);
  }
  // Рахунку немає взагалі (не вдалося виставити) — теж можна оплатити.
  const store = fakeStore({ ...unpaid(), wfp_order_reference: null });
  assert.equal((await syncPayment(store, await store.get())).state, 'none');
});

test('WayForPay не відповів — нічого не обіцяємо, але й «не пройшла» не кажемо', async () => {
  wfp = () => { throw new Error('мережа'); };
  const store = fakeStore(unpaid());
  assert.equal((await syncPayment(store, await store.get())).state, 'pending');
});

test('колбек і звірка одночасно: подарунок і позначка — 1 раз', async () => {
  const store = fakeStore(unpaid());
  const entry = await store.get();
  await Promise.all([markPaid(store, entry), markPaid(store, entry), markPaid(store, entry)]);
  assert.equal(store.calls.gift, 1);
  assert.equal(store.state.plus_token, 'g'.repeat(32));
});

test('доставка диплома: поки оплата йде, форму вдруге не показуємо', async () => {
  const PREF = `olimp-d-${TOKEN}-2`;
  const row = { ...unpaid(), paid_at: '2026-10-07T10:00:00Z', finished_at: '2026-10-07T10:40:00Z', print_ref: PREF };
  wfp = () => signed({ orderReference: PREF, amount: 120, transactionStatus: 'InProcessing', reasonCode: 1100 });
  let store = fakeStore(row);
  assert.equal((await syncPrint(store, await store.get())).pending, true);
  wfp = () => signed({ orderReference: PREF, amount: 120, transactionStatus: 'Approved', reasonCode: 1100 });
  store = fakeStore(row);
  const r = await syncPrint(store, await store.get());
  assert.equal(r.pending, false);
  assert.ok(store.state.print_paid_at);
  wfp = () => signed({ orderReference: PREF, amount: '', transactionStatus: 'Declined', reasonCode: 1127 });
  store = fakeStore(row);
  assert.equal((await syncPrint(store, await store.get())).pending, false);
});

test('запрошення: посилання, участь безкоштовна, друкований диплом 199 грн', () => {
  const entry = { token: TOKEN, child_name: 'Марк Петренко', paid_at: '2026-10-07T10:00:00Z', amount: 0 };
  const { subject, text, html } = buildInvite(entry);
  assert.equal(subject, 'Запрошення до онлайн-олімпіади з логіки — Марк Петренко');
  assert.match(text, new RegExp(`/olimpiada/test\\?t=${TOKEN}`));
  assert.match(text, /Участь безкоштовна/);
  assert.match(text, /друкований — 199 грн, доставка у відділення або поштомат Нової пошти включена/);
  // З 08.10.2026 ні строку «після оплати», ні неповернення внеску.
  assert.doesNotMatch(text, /після оплати|внесок/);
  assert.doesNotMatch(html, /внесок/);
  assert.match(html, /Перейти до тесту/);
});

test('запрошення сайту й запасного скрипта — ті самі слова', () => {
  const py = readFileSync('scraper/olimpiada_invites.py', 'utf8').replace(/"\s*\n\s*f?"/g, '');
  for (const phrase of [
    'Заявку отримали — ',
    'бере участь в онлайн-олімпіаді з логіки Dityam.com.ua. Участь безкоштовна.',
    'тест можна пройти в зручний час: ',
    'останнє завдання — відкрите: без варіантів і без таймера, дитина пише свою відповідь; воно вирішує, хто отримає приз місяця;',
    'а відкрите завдання можна дописати без поспіху;',
    'грн, доставка у відділення або поштомат Нової пошти включена;',
    'переможців місяця оголосимо до 7-го числа наступного місяця; якщо',
  ]) {
    assert.ok(buildInvite({ token: TOKEN, child_name: 'М', paid_at: '2026-10-07T10:00:00Z', amount: 0 }).text.includes(phrase), `сайт: ${phrase}`);
    assert.ok(py.includes(phrase), `скрипт: ${phrase}`);
  }
});

test('лист не шлемо без пароля, з тестового сховища й без email — і не «бронюємо»', async () => {
  let claimed = 0;
  const store = { dev: false, claim: async () => { claimed += 1; return {}; }, update: async () => ({}) };
  const paid = { token: TOKEN, parent_email: 'mama@example.com', paid_at: '2026-10-07T10:00:00Z' };
  assert.equal(await sendInvite(store, paid), false);   // пароля немає
  assert.equal(await sendInvite({ ...store, dev: true }, paid), false);
  assert.equal(await sendInvite(store, { ...paid, parent_email: '' }), false);
  assert.equal(await sendInvite(store, { ...paid, invite_sent_at: 'x' }), false);
  assert.equal(claimed, 0);
});
