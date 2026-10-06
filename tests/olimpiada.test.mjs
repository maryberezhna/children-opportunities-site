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
  OLIMP, LEVELS, PRIZES, levelFor, buildOrder, publicQuestions, scoreAnswers, monthKey, monthName,
  deadlineOf, diplomaNo, diplomaDate, cleanName, isEmail, giftActive, giftExpired,
  accessUntil, accessExpired, kyivDateTime, cleanPrintOrder,
} = await import('../lib/olimpiada.js');
const { oneTimeInvoiceBody, isOurOrderRef } = await import('../lib/wayforpay.js');

const byId = Object.fromEntries(BANK.map((q) => [q.id, q]));
const optKey = (o) => JSON.stringify(o);

// Маленький банк із ключами — для перевірки підрахунку: справжні ключі
// лежать у базі, не в репозиторії.
const MINI = [
  { id: 'm1', tier: 1, q: 'a', options: ['1', '2', '3', '4'] },
  { id: 'm2', tier: 2, q: 'b', options: [{ art: '<svg/>' }, { art: '<svg />' }, { art: '<svg></svg>' }, { art: '<svg><g/></svg>' }] },
  { id: 'm3', tier: 3, q: 'c', options: ['x', 'y', 'z', 'w'] },
];
const MINI_KEYS = { m1: 2, m2: 0, m3: 3 };

test('банк: 25 ілюстрованих завдань, кожне коректне, без відповідей у коді', () => {
  assert.equal(BANK.length, OLIMP.questionCount);
  assert.equal(new Set(BANK.map((q) => q.id)).size, BANK.length);
  let withArt = 0;
  for (const q of BANK) {
    assert.equal(q.options.length, 4, q.id);
    assert.equal(new Set(q.options.map(optKey)).size, 4, `${q.id}: варіанти повторюються`);
    assert.ok([1, 2, 3].includes(q.tier), `${q.id}: tier`);
    assert.ok(q.q.length > 5, q.id);
    // репозиторій публічний — відповідь у банку означала б, що її видно всім
    assert.equal('answer' in q, false, `${q.id}: відповідь у коді`);
    const arts = [q.art, ...q.options.map((o) => o && o.art)].filter(Boolean);
    for (const a of arts) assert.ok(a.startsWith('<svg') && a.endsWith('</svg>'), `${q.id}: SVG`);
    if (arts.length) withArt += 1;
    for (const o of q.options) assert.ok(typeof o === 'string' ? o.length > 0 : (o.art || o.text), `${q.id}: порожній варіант`);
    // жодних емодзі чи Unicode-фігур — на різних телефонах вони різні
    assert.ok(!/[\u2600-\u27BF\u2B00-\u2BFF\u{1F300}-\u{1FAFF}]/u.test(JSON.stringify(q)), `${q.id}: символи`);
  }
  assert.ok(withArt >= 22, `з малюнком лише ${withArt}`);
  // від легких до складних, рівнів порівну
  const tiers = BANK.map((q) => q.tier);
  assert.deepEqual(tiers, [...tiers].sort((a, b) => a - b));
  assert.ok(tiers.filter((t) => t === 1).length >= 7 && tiers.filter((t) => t === 3).length >= 7);
});

test('порядок: той самий токен — той самий порядок; легкі завдання першими', () => {
  const a = buildOrder(BANK, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  const again = buildOrder(BANK, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  const b = buildOrder(BANK, 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
  assert.deepEqual(a, again);
  assert.notDeepEqual(a.map((o) => o.id), b.map((o) => o.id));
  assert.equal(a.length, OLIMP.questionCount);
  assert.deepEqual([...a.map((o) => o.id)].sort(), BANK.map((q) => q.id).sort());
  const tierOf = (id) => byId[id].tier;
  const seq = a.map((o) => tierOf(o.id));
  assert.deepEqual(seq, [...seq].sort((x, y) => x - y), 'легкі мають іти першими');
  for (const o of a) assert.deepEqual([...o.options].sort(), [0, 1, 2, 3]);
});

test('у браузер питання йдуть з малюнками, але без правильних відповідей', () => {
  const order = buildOrder(BANK, 'cccccccccccccccccccccccccccccccc');
  const pub = publicQuestions(BANK, order);
  assert.equal(pub.length, OLIMP.questionCount);
  for (const q of pub) {
    assert.deepEqual(Object.keys(q).sort(), ['art', 'id', 'options', 'q']);
    assert.equal(q.options.length, 4);
    const src = byId[q.id].options[q.options[0].id];
    if (typeof src === 'string') assert.equal(q.options[0].text, src);
    else assert.equal(q.options[0].art, src.art || null);
  }
  assert.ok(!JSON.stringify(pub).includes('"answer"'));
});

test('бали: за ключами з бази, лише за видані завдання; без ключів — 0', () => {
  const order = buildOrder(MINI, 'dddddddddddddddddddddddddddddddd', 3);
  assert.deepEqual(scoreAnswers(MINI, order, { m1: 2, m2: 0, m3: 3 }, MINI_KEYS), { score: 3, max: 3, answered: 3 });
  assert.deepEqual(scoreAnswers(MINI, order, {}, MINI_KEYS), { score: 0, max: 3, answered: 0 });
  assert.equal(scoreAnswers(MINI, order, { m1: 3, m2: 1, m3: 0 }, MINI_KEYS).score, 0);
  // рядок «2» — теж відповідь; чужий ключ у запиті не додає балів; без ключа питання не зараховується
  assert.equal(scoreAnswers(MINI, order, { m1: '2', zzz: 0 }, MINI_KEYS).score, 1);
  assert.equal(scoreAnswers(MINI, order.slice(0, 2), { m1: 2, m2: 0, m3: 3 }, MINI_KEYS).max, 2);
  assert.equal(scoreAnswers(MINI, order, { m1: 2 }, { m2: 0 }).score, 0);
  assert.equal(scoreAnswers(MINI, order, { m1: 2 }, null).score, 0);
  // варіанти-картинки йдуть у браузер як art, без тексту
  const pub = publicQuestions(MINI, order);
  const m2 = pub.find((q) => q.id === 'm2');
  assert.ok(m2.options.every((o) => o.art && o.text === null));
});

test('25 завдань, 35 хвилин; рівні диплома: пороги 22 / 17 / 12', () => {
  assert.equal(OLIMP.questionCount, 25);
  assert.equal(OLIMP.minutes, 35);
  assert.deepEqual(LEVELS.map((l) => l.min), [22, 17, 12, 0]);
  assert.equal(levelFor(25).key, 'gold');
  assert.equal(levelFor(22).key, 'gold');
  assert.equal(levelFor(21).key, 'silver');
  assert.equal(levelFor(17).key, 'silver');
  assert.equal(levelFor(16).key, 'bronze');
  assert.equal(levelFor(12).key, 'bronze');
  assert.equal(levelFor(11).key, 'participant');
  assert.equal(levelFor(0).key, 'participant');
});

test('час і дати — за Києвом', () => {
  assert.equal(deadlineOf('2026-10-05T10:00:00Z').toISOString(), '2026-10-05T10:35:00.000Z');
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

test('72 години на початок тесту: потім доступ закрито, розпочатий тест не «згорає»', () => {
  const paid = '2026-10-05T10:00:00Z';
  assert.equal(OLIMP.accessHours, 72);
  assert.equal(accessUntil(paid).toISOString(), '2026-10-08T10:00:00.000Z');
  assert.equal(accessExpired({ paid_at: paid }, new Date('2026-10-08T09:59:00Z')), false);
  assert.equal(accessExpired({ paid_at: paid }, new Date('2026-10-08T10:01:00Z')), true);
  assert.equal(accessExpired({ paid_at: paid, started_at: '2026-10-08T09:50:00Z' }, new Date('2026-10-09T00:00:00Z')), false);
  assert.equal(accessExpired({}, new Date()), false);
  assert.equal(kyivDateTime('2026-10-08T10:00:00Z'), '8 жовтня, 13:00');
});

test('призи місяця: 3 місця, усі з точною назвою й фото, без планшета й артикулів', () => {
  assert.deepEqual(PRIZES.map((p) => p.place), [1, 2, 3]);
  for (const p of PRIZES) {
    assert.ok(p.title.length > 10 && p.note, `приз ${p.place}`);
    assert.match(p.image, /^\/olimpiada\/prize-[a-z]+\.jpg$/);
    assert.ok(!/планшет/i.test(p.title));
    assert.ok(!/\(\d{4,}\)/.test(p.title), `${p.title}: артикул у назві`);
  }
});

test('друкований диплом: дані доставки з форми', () => {
  assert.equal(OLIMP.printPrice, 120);
  assert.deepEqual(cleanPrintOrder({ name: ' Олена  Коваленко ', phone: '+380 67 123 45 67', city: 'Львів', branch: 'відділення 12' }),
    { order: { name: 'Олена Коваленко', phone: '+380 67 123 45 67', city: 'Львів', branch: 'відділення 12' } });
  assert.deepEqual(cleanPrintOrder({ name: 'Ол' }), { error: 'name' });
  assert.deepEqual(cleanPrintOrder({ name: 'Олена Коваленко', phone: '12345' }), { error: 'phone' });
  assert.deepEqual(cleanPrintOrder({ name: 'Олена Коваленко', phone: '0671234567', city: '' }), { error: 'city' });
  assert.deepEqual(cleanPrintOrder({ name: 'Олена Коваленко', phone: '0671234567', city: 'Львів', branch: '' }), { error: 'branch' });
});

test('друкований диплом: оплата приходить своїм номером замовлення і не плутається з внеском', async () => {
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const { getStore, handleOlimpCallback, isPrintOrder, isOlimpOrder } = await import('../lib/olimpiada-server.js');
  const store = getStore();
  const entry = await store.create({ child_name: 'Марко Шевчук', child_age: 9, parent_email: 'tato@example.com', paid_at: '2026-10-05T10:00:00Z', finished_at: '2026-10-05T11:00:00Z', score: 20, max_score: 25 });
  const ref = `olimp-d-${entry.token}-1791200000000`;
  assert.equal(isPrintOrder(ref), true);
  assert.equal(isOlimpOrder(ref), true);
  assert.equal(isPrintOrder(`olimp-${entry.token}-1791200000000`), false);
  await store.update(entry.token, { print_ref: ref, print_order: { name: 'Тато', phone: '0671234567', city: 'Київ', branch: '5' } });
  await handleOlimpCallback({ orderReference: ref, transactionStatus: 'Declined' });
  assert.equal((await store.get(entry.token)).print_paid_at, undefined);
  await handleOlimpCallback({ orderReference: ref, transactionStatus: 'Approved' });
  const paidAt = (await store.get(entry.token)).print_paid_at;
  assert.ok(paidAt);
  await handleOlimpCallback({ orderReference: ref, transactionStatus: 'Approved' });
  assert.equal((await store.get(entry.token)).print_paid_at, paidAt);
});
