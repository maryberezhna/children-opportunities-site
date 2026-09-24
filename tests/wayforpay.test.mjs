// Суми в рахунку WayForPay. Регресія, проти якої стоїть тест: знижений перший
// платіж (за промокодом — 1 грн) не сміє стати ціною регулярних списань — без
// явного regularAmount WayForPay бере його з amount, і людину щомісяця
// списували б по 1 грн.
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.WAYFORPAY_MERCHANT_ACCOUNT = 'test_merchant';
process.env.WAYFORPAY_SECRET_KEY = 'test_secret';
delete process.env.WAYFORPAY_AMOUNT;
delete process.env.WAYFORPAY_AMOUNT_YEAR;
delete process.env.WAYFORPAY_AMOUNT_EARLY;

const { invoiceBody, tokenFromOrderRef, periodFromOrderRef, describeFailure, FAILED_STATUSES, payStartUrl, PRICE, PRICE_YEAR } = await import('../lib/wayforpay.js');
const { readFileSync } = await import('node:fs');

const sub = { unsub_token: 'abc123def456', email: null, phone: '+380501112233' };
const now = new Date(2026, 8, 14, 12, 0, 0);   // 14.09.2026

test('ціни за замовчуванням — 119 / 999', () => {
  assert.equal(PRICE, 119);
  assert.equal(PRICE_YEAR, 999);
});

test('звичайна місячна: перший платіж і регулярні — 119', () => {
  const b = invoiceBody(sub, 'monthly', { now });
  assert.equal(b.amount, 119);
  assert.deepEqual(b.productPrice, [119]);
  assert.equal(b.regularAmount, 119);
  assert.equal(b.regularMode, 'monthly');
  assert.equal(b.regularOn, 1);
  assert.equal(b.dateNext, '14.10.2026');
});

test('знижений перший платіж: 1 грн зараз, регулярні — повна ціна', () => {
  const b = invoiceBody(sub, 'monthly', { firstAmount: 1, now });
  assert.equal(b.amount, 1);
  assert.deepEqual(b.productPrice, [1]);
  assert.equal(b.regularAmount, 119);
  assert.equal(b.dateNext, '14.10.2026');
});

test('річна без промокоду — повна ціна', () => {
  const b = invoiceBody(sub, 'yearly', { now });
  assert.equal(b.amount, 999);
  assert.equal(b.regularAmount, 999);
  assert.equal(b.regularMode, 'yearly');
  assert.equal(b.dateNext, '14.09.2027');
});

test('підпис рахується від суми першого платежу', () => {
  const regular = invoiceBody(sub, 'monthly', { now });
  const early = invoiceBody(sub, 'monthly', { firstAmount: 1, now });
  assert.match(regular.merchantSignature, /^[0-9a-f]{32}$/);
  assert.notEqual(regular.merchantSignature, early.merchantSignature);
});

test('orderReference повертає токен підписника', () => {
  const b = invoiceBody(sub, 'monthly', { now });
  assert.equal(tokenFromOrderRef(b.orderReference), sub.unsub_token);
});

// З промокодом перший річний платіж — 799, менше за 999. Колбек визначав період
// за сумою й записував таку підписку «місячною» (22.09.2026).
test('річна підписка з промокодом — річна, а не місячна', () => {
  const y = invoiceBody(sub, 'yearly', { firstAmount: 799, now });
  const m = invoiceBody(sub, 'monthly', { firstAmount: 1, now });
  assert.equal(tokenFromOrderRef(y.orderReference), sub.unsub_token);
  assert.equal(periodFromOrderRef(y.orderReference, y.amount), 'yearly');
  assert.equal(periodFromOrderRef(m.orderReference, m.amount), 'monthly');
});

test('старі номери замовлень без позначки — за сумою, як раніше', () => {
  assert.equal(periodFromOrderRef('abc123def456-1789900000000', 999), 'yearly');
  assert.equal(periodFromOrderRef('abc123def456-1789900000000', 119), 'monthly');
});

// Причина відмови. Регресія, проти якої стоїть тест: 24.09.2026 перший же
// DECLINE у WayForPay ліг у базу як голе «paused» — reasonCode ми викидали,
// і чому людина не оплатила, можна було дізнатись лише в кабінеті WayForPay.
test('describeFailure: код WayForPay перекладається на причину', () => {
  assert.equal(describeFailure({ status: 'Declined', reasonCode: 1104 }), 'недостатньо коштів на картці (1104)');
  assert.equal(describeFailure({ status: 'Declined', reasonCode: '1108' }), '3-D Secure не пройдено (1108)');
});

// Саме той випадок, з якого почався цей код: WayForPay прислав Declined,
// але Payment type = NO PAYMENT — картку не вводили, банк нічого не відхиляв.
test('describeFailure: 1124 не називається відмовою банку', () => {
  const t = describeFailure({ status: 'Declined', reasonCode: 1124, reason: 'Cardholder session expired' });
  assert.equal(t, 'сесія на сторінці оплати збігла — оплату не завершили (1124)');
  assert.doesNotMatch(t, /банк/);
});

test('describeFailure: Expired — це не відмова банку', () => {
  assert.doesNotMatch(describeFailure({ status: 'Expired' }), /відхилив/);
  assert.match(describeFailure({ status: 'Expired' }), /протермінувався/);
});

test('describeFailure: незнайомий код не ковтаємо — показуємо текст WayForPay', () => {
  assert.equal(
    describeFailure({ status: 'Voided', reasonCode: 9999, reason: 'Some New Thing' }),
    'платіж скасовано — Some New Thing (9999)',
  );
});

test('describeFailure: без причини — загальний рядок, не «undefined»', () => {
  assert.equal(describeFailure({}), 'оплата не пройшла');
  assert.equal(describeFailure({ status: 'Declined' }), 'банк відхилив оплату');
});

test('FAILED_STATUSES накриває всі невдалі статуси колбека', () => {
  assert.deepEqual(
    Object.keys(FAILED_STATUSES),
    ['Declined', 'Expired', 'Refunded', 'Voided', 'RefundInProcessing'],
  );
});

// Посилання на оплату. Регресія, проти якої стоять ці тести: 24.09.2026
// кнопка в @DityamPlusBot несла готовий invoiceUrl, зроблений у мить
// відправки повідомлення. Рахунок WayForPay живе годину, повідомлення в чаті
// — вічно, тож кнопки просто вмирали, і людина бачила «посилання застаріло».
test('payStartUrl веде на наш перехід, а не на WayForPay', () => {
  const u = payStartUrl('abc123def456', 'monthly');
  assert.match(u, /\/api\/pay\/start\?t=abc123def456&plan=monthly$/);
  assert.doesNotMatch(u, /wayforpay/);
});

test('payStartUrl: план тільки з двох відомих, сміття — місяць', () => {
  assert.match(payStartUrl('t', 'yearly'), /plan=yearly$/);
  assert.match(payStartUrl('t', 'хтозна'), /plan=monthly$/);
  assert.match(payStartUrl('t'), /plan=monthly$/);
});

test('payStartUrl екранує токен', () => {
  assert.match(payStartUrl('a b&c'), /t=a%20b%26c&/);
});

test('бот не зашиває рахунок у кнопку', () => {
  const src = readFileSync(new URL('../app/api/telegram/plus/route.js', import.meta.url), 'utf8');
  assert.ok(src.includes('payStartUrl('), 'кнопки мають вести на /api/pay/start');
  assert.ok(!src.includes('createInvoice'), 'рахунок створюється в мить кліку, не при показі кнопки');
});
