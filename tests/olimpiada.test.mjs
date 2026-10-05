// Онлайн-олімпіада: банк завдань, порядок, бали, рівні, рахунок WayForPay.
// Регресії, проти яких стоїть тест: завдання з двома однаковими варіантами чи
// неправильною відповіддю (це платний тест), правильні відповіді в браузері,
// бали за чужі ключі в запиті.
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.WAYFORPAY_MERCHANT_ACCOUNT = 'test_merchant';
process.env.WAYFORPAY_SECRET_KEY = 'test_secret';

const { BANK } = await import('../content/olimpiada/lohika-9-11.js');
const {
  OLIMP, LEVELS, levelFor, buildOrder, publicQuestions, scoreAnswers, monthKey, monthName,
  deadlineOf, diplomaNo, diplomaDate, cleanName, isEmail, giftActive, giftExpired,
} = await import('../lib/olimpiada.js');
const { oneTimeInvoiceBody, isOurOrderRef } = await import('../lib/wayforpay.js');

const byId = Object.fromEntries(BANK.map((q) => [q.id, q]));
const right = (id) => byId[id].options[byId[id].answer];

test('банк: стільки завдань, скільки в налаштуваннях, і кожне коректне', () => {
  assert.equal(BANK.length, OLIMP.questionCount);
  assert.equal(new Set(BANK.map((q) => q.id)).size, BANK.length);
  for (const q of BANK) {
    assert.equal(q.options.length, 4, q.id);
    assert.equal(new Set(q.options).size, 4, `${q.id}: варіанти повторюються`);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4, q.id);
    assert.ok(q.q.length > 5, q.id);
  }
});

test('відповіді, які можна перерахувати, — правильні', () => {
  assert.equal(right('l02'), '10');
  assert.equal(right('l03'), String(3 + 1));
  assert.equal(right('l05'), String(3 * 2 + 2 * 4));
  assert.equal(right('l06'), '20');
  assert.equal(right('l11'), String(5 + 8));
  assert.equal(right('l12'), `${9 + 5}:00`);
  // 24 учні, дівчат удвічі більше
  assert.equal(right('l13'), String((24 / 3) * 2));
  assert.equal(right('l14'), `у ${36 / 9}`);
  // цифра 7 у числах 1..50
  const sevens = Array.from({ length: 50 }, (_, i) => String(i + 1)).join('').split('7').length - 1;
  assert.equal(right('l15'), String(sevens));
  // равлик: +3 за день, −2 за ніч, стовп 5 м
  let h = 0; let day = 0;
  for (;;) { day += 1; h += 3; if (h >= 5) break; h -= 2; }
  assert.equal(right('l17'), `на ${day}-й`);
  const same = Array.from({ length: 90 }, (_, i) => String(i + 10)).filter((n) => n[0] === n[1]).length;
  assert.equal(right('l19'), String(same));
  assert.equal(right('l20'), String((20 + 4) / 2));
  assert.equal(right('l22'), '3');
  assert.equal(right('l23'), String(6 * 6));
  assert.equal(right('l24'), '8:00');
  // найбільше тризначне з 12345 без 2 цифр, порядок зберігаємо
  const digits = '12345'.split('');
  let best = 0;
  for (let a = 0; a < 5; a += 1) for (let b = a + 1; b < 5; b += 1) {
    best = Math.max(best, Number(digits.filter((_, i) => i !== a && i !== b).join('')));
  }
  assert.equal(right('l25'), String(best));
  // кури й кролики: 10 голів, 28 ніг
  let rabbits = null;
  for (let r = 0; r <= 10; r += 1) if (r * 4 + (10 - r) * 2 === 28) rabbits = r;
  assert.equal(right('l26'), String(rabbits));
  assert.equal(right('l27'), String((4 * 3) / 2));
  // мама старша на 24; через 2 роки — втричі
  let olia = null;
  for (let o = 1; o < 40; o += 1) if (o + 24 + 2 === 3 * (o + 2)) olia = o;
  assert.equal(right('l28'), String(olia));
  assert.equal(right('l29'), String(17 + 16));
  assert.equal(right('l30'), String(3 * 2 * 1));
});

test('порядок: той самий токен — той самий порядок; легкі завдання першими', () => {
  const a = buildOrder(BANK, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  const again = buildOrder(BANK, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  const b = buildOrder(BANK, 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
  assert.deepEqual(a, again);
  assert.notDeepEqual(a.map((o) => o.id), b.map((o) => o.id));
  assert.equal(a.length, OLIMP.questionCount);
  assert.deepEqual([...a.map((o) => o.id)].sort(), BANK.map((q) => q.id).sort());
  const easy = new Set(BANK.slice(0, 10).map((q) => q.id));
  const hard = new Set(BANK.slice(20).map((q) => q.id));
  assert.ok(a.slice(0, 10).every((o) => easy.has(o.id)));
  assert.ok(a.slice(20).every((o) => hard.has(o.id)));
  for (const o of a) assert.deepEqual([...o.options].sort(), [0, 1, 2, 3]);
});

test('у браузер питання йдуть без правильних відповідей', () => {
  const order = buildOrder(BANK, 'cccccccccccccccccccccccccccccccc');
  const pub = publicQuestions(BANK, order);
  assert.equal(pub.length, OLIMP.questionCount);
  for (const q of pub) {
    assert.deepEqual(Object.keys(q).sort(), ['id', 'options', 'q']);
    assert.equal(q.options.length, 4);
    assert.equal(byId[q.id].options[q.options[0].id], q.options[0].text);
  }
  assert.ok(!JSON.stringify(pub).includes('"answer"'));
});

test('бали: лише за видані завдання, порожнє й хибне — 0', () => {
  const order = buildOrder(BANK, 'dddddddddddddddddddddddddddddddd');
  const all = Object.fromEntries(BANK.map((q) => [q.id, q.answer]));
  assert.deepEqual(scoreAnswers(BANK, order, all), { score: 30, max: 30, answered: 30 });
  assert.deepEqual(scoreAnswers(BANK, order, {}), { score: 0, max: 30, answered: 0 });
  const wrong = Object.fromEntries(BANK.map((q) => [q.id, (q.answer + 1) % 4]));
  assert.equal(scoreAnswers(BANK, order, wrong).score, 0);
  // чужий ключ у запиті не додає балів
  assert.equal(scoreAnswers(BANK, order.slice(0, 5), { ...all, zzz: 0 }).max, 5);
  assert.equal(scoreAnswers(BANK, order, { [BANK[0].id]: String(BANK[0].answer) }).score, 1);
});

test('рівні диплома: пороги 26 / 20 / 14', () => {
  assert.deepEqual(LEVELS.map((l) => l.min), [26, 20, 14, 0]);
  assert.equal(levelFor(30).key, 'gold');
  assert.equal(levelFor(26).key, 'gold');
  assert.equal(levelFor(25).key, 'silver');
  assert.equal(levelFor(20).key, 'silver');
  assert.equal(levelFor(19).key, 'bronze');
  assert.equal(levelFor(14).key, 'bronze');
  assert.equal(levelFor(13).key, 'participant');
  assert.equal(levelFor(0).key, 'participant');
});

test('час і дати — за Києвом', () => {
  assert.equal(deadlineOf('2026-10-05T10:00:00Z').toISOString(), '2026-10-05T10:40:00.000Z');
  // 31 жовтня 23:30 UTC — у Києві вже 1 листопада
  assert.equal(monthKey(new Date('2026-10-31T23:30:00Z')), '2026-11');
  assert.equal(monthKey(new Date('2026-10-05T12:00:00Z')), '2026-10');
  assert.equal(monthName('2026-10'), 'жовтень');
  assert.equal(diplomaDate('2026-10-05T19:00:00Z'), '5 жовтня 2026');
  assert.equal(diplomaNo('9cabd081887339b3edeadead8ffb15e2'), 'ОЛ-9CABD081');
});

test('імʼя й email із форми', () => {
  assert.equal(cleanName('  Соломія   Коваленко '), 'Соломія Коваленко');
  assert.equal(cleanName('x'.repeat(100)).length, 60);
  assert.ok(isEmail('mama@example.com'));
  assert.ok(!isEmail('mama@example'));
  assert.ok(!isEmail('mama example.com'));
});

test('подарунковий місяць Dityam+: активний, минув, оплачений', () => {
  const now = new Date('2026-10-20T00:00:00Z');
  const gift = { billing_period: 'gift', gift_until: '2026-11-05T00:00:00Z', wfp_order_reference: null };
  assert.equal(giftActive(gift, now), true);
  assert.equal(giftExpired(gift, now), false);
  const old = { ...gift, gift_until: '2026-10-10T00:00:00Z' };
  assert.equal(giftActive(old, now), false);
  assert.equal(giftExpired(old, now), true);
  // оплатив після подарунка — колбек ставить справжній період, і «минув» не кажемо
  assert.equal(giftExpired({ ...old, billing_period: 'monthly', wfp_order_reference: 'abc-1' }, now), false);
  assert.equal(giftExpired({ billing_period: 'monthly' }, now), false);
  // подарунок без дати не вважаємо активним
  assert.equal(giftActive({ billing_period: 'gift', gift_until: null }, now), false);
});

test('рахунок олімпіади: разовий, 150 грн, свій колбек', () => {
  const b = oneTimeInvoiceBody({
    orderReference: 'olimp-9cabd081887339b3edeadead8ffb15e2-1791200000000', amount: OLIMP.price,
    product: 'Участь в онлайн-олімпіаді', email: 'mama@example.com',
    returnUrl: 'https://dityam.com.ua/api/olimpiada/return?t=x', serviceUrl: 'https://dityam.com.ua/api/olimpiada/pay',
    now: new Date(2026, 9, 5, 12, 0, 0),
  });
  assert.equal(b.amount, 150);
  assert.deepEqual(b.productPrice, [150]);
  assert.equal(b.serviceUrl, 'https://dityam.com.ua/api/olimpiada/pay');
  assert.equal(b.regularMode, undefined);
  assert.equal(b.regularOn, undefined);
  assert.match(b.merchantSignature, /^[0-9a-f]{32}$/);
  // номер замовлення олімпіади не сплутати з підпискою Dityam+
  assert.equal(isOurOrderRef(b.orderReference), false);
});

// Колбек оплати — на запасному сховищі в памʼяті (локально й у тестах
// сервісного ключа немає; у продакшні це Supabase з тими самими методами).
test('колбек WayForPay: Approved відкриває тест і дає місяць Dityam+, повтор нічого не дублює', async () => {
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const { getStore, handleOlimpCallback, isOlimpOrder, validToken } = await import('../lib/olimpiada-server.js');
  const store = getStore();
  assert.equal(store.dev, true);
  const entry = await store.create({ child_name: 'Соломія Коваленко', child_age: 10, parent_email: 'mama@example.com' });
  assert.ok(validToken(entry.token));
  const ref = `olimp-${entry.token}-1791200000000`;
  await store.update(entry.token, { wfp_order_reference: ref });
  assert.equal(isOlimpOrder(ref), true);
  assert.equal(isOlimpOrder('9cabd081887339b3edeadead8ffb15e2-1791200000000-m'), false);

  // відхилений платіж тест не відкриває
  await handleOlimpCallback({ orderReference: ref, transactionStatus: 'Declined', reason: 'Insufficient funds' });
  let row = await store.get(entry.token);
  assert.equal(row.paid_at, undefined);
  assert.equal(row.wfp_last_status, 'Declined');

  await handleOlimpCallback({ orderReference: ref, transactionStatus: 'Approved' });
  row = await store.get(entry.token);
  assert.ok(row.paid_at);
  assert.ok(validToken(row.plus_token));
  const { paid_at: paidAt, plus_token: plusToken } = row;

  // WayForPay повторює колбек — дата оплати й подарунок лишаються тими самими
  await handleOlimpCallback({ orderReference: ref, transactionStatus: 'Approved' });
  row = await store.get(entry.token);
  assert.equal(row.paid_at, paidAt);
  assert.equal(row.plus_token, plusToken);

  // чужий номер замовлення нічого не ламає
  await handleOlimpCallback({ orderReference: 'olimp-00000000000000000000000000000000-1', transactionStatus: 'Approved' });
});
