// Суми в рахунку WayForPay. Регресія, проти якої стоїть тест: перший місяць
// для списку очікування (безкоштовний — технічно 1 грн, бо 0 грн платіжний
// сервіс не проводить) не сміє стати ціною регулярних списань — без явного
// regularAmount WayForPay бере його з amount, і людину щомісяця списували б
// по 1 грн.
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.WAYFORPAY_MERCHANT_ACCOUNT = 'test_merchant';
process.env.WAYFORPAY_SECRET_KEY = 'test_secret';
delete process.env.WAYFORPAY_AMOUNT;
delete process.env.WAYFORPAY_AMOUNT_YEAR;
delete process.env.WAYFORPAY_AMOUNT_EARLY;

const { invoiceBody, tokenFromOrderRef, PRICE, PRICE_YEAR, PRICE_EARLY } = await import('../lib/wayforpay.js');

const sub = { unsub_token: 'abc123def456', email: null, phone: '+380501112233' };
const now = new Date(2026, 8, 14, 12, 0, 0);   // 14.09.2026

test('ціни за замовчуванням — 99 / 999 / 1', () => {
  assert.equal(PRICE, 99);
  assert.equal(PRICE_YEAR, 999);
  assert.equal(PRICE_EARLY, 1);
});

test('звичайна місячна: перший платіж і регулярні — 99', () => {
  const b = invoiceBody(sub, 'monthly', { now });
  assert.equal(b.amount, 99);
  assert.deepEqual(b.productPrice, [99]);
  assert.equal(b.regularAmount, 99);
  assert.equal(b.regularMode, 'monthly');
  assert.equal(b.regularOn, 1);
  assert.equal(b.dateNext, '14.10.2026');
});

test('список очікування: перший платіж 1 грн, регулярні — повна ціна', () => {
  const b = invoiceBody(sub, 'monthly', { early: true, now });
  assert.equal(b.amount, 1);
  assert.deepEqual(b.productPrice, [1]);
  assert.equal(b.regularAmount, 99);
  assert.equal(b.dateNext, '14.10.2026');
});

test('на річну знижка не діє', () => {
  const b = invoiceBody(sub, 'yearly', { early: true, now });
  assert.equal(b.amount, 999);
  assert.equal(b.regularAmount, 999);
  assert.equal(b.regularMode, 'yearly');
  assert.equal(b.dateNext, '14.09.2027');
});

test('підпис рахується від суми першого платежу', () => {
  const regular = invoiceBody(sub, 'monthly', { now });
  const early = invoiceBody(sub, 'monthly', { early: true, now });
  assert.match(regular.merchantSignature, /^[0-9a-f]{32}$/);
  assert.notEqual(regular.merchantSignature, early.merchantSignature);
});

test('orderReference повертає токен підписника', () => {
  const b = invoiceBody(sub, 'monthly', { now });
  assert.equal(tokenFromOrderRef(b.orderReference), sub.unsub_token);
});
