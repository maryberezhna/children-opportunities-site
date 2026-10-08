// Перший місяць Dityam+ за 1 грн — усім, хто ще не платив (Марія, 08.10.2026).
// Регресії: пробний місяць не повторюється тому, хто вже платив; пів року без
// промокоду — повна ціна; промокод із меншою сумою не губиться; регулярне
// списання завжди повне.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

process.env.WAYFORPAY_MERCHANT_ACCOUNT = 'test_merchant';
process.env.WAYFORPAY_SECRET_KEY = 'test_secret';
delete process.env.WAYFORPAY_AMOUNT;
delete process.env.WAYFORPAY_AMOUNT_HALF;
delete process.env.WAYFORPAY_AMOUNT_FIRST;

const { firstPaymentAmount, invoiceBody, PRICE, PRICE_FIRST } = await import('../lib/wayforpay.js');

test('Перший місяць: 1 грн тому, хто ще не платив', () => {
  assert.equal(PRICE_FIRST, 1);
  assert.equal(firstPaymentAmount({ plan: 'monthly' }), 1);
});

test('Перший місяць: хто вже платив — повна ціна', () => {
  assert.equal(firstPaymentAmount({ plan: 'monthly', paidBefore: true }), null);
  assert.equal(firstPaymentAmount({ plan: 'halfyear', paidBefore: true, promo: { halfyear_amount: 439 } }), null);
});

test('Пів року: знижка лише за промокодом', () => {
  assert.equal(firstPaymentAmount({ plan: 'halfyear' }), null);
  assert.equal(firstPaymentAmount({ plan: 'halfyear', promo: { first_amount: 1, halfyear_amount: 439 } }), 439);
});

test('Промокод не дорожчий за пробний місяць', () => {
  assert.equal(firstPaymentAmount({ plan: 'monthly', promo: { first_amount: 50 } }), 1);
});

test('Рахунок: перший платіж 1 грн, регулярний — повна ціна', () => {
  const b = invoiceBody({ unsub_token: 'tok' }, 'monthly', { firstAmount: firstPaymentAmount({ plan: 'monthly' }), now: new Date('2026-10-08T10:00:00Z') });
  assert.equal(b.amount, 1);
  assert.equal(b.regularAmount, PRICE);
});

test('Бот і перехід на оплату рахують перший платіж однією функцією', () => {
  for (const f of ['app/api/pay/start/route.js', 'app/api/telegram/plus/route.js']) {
    assert.match(readFileSync(f, 'utf8'), /firstPaymentAmount\(/, f);
  }
});

test('Перше повідомлення бота називає ціну першого місяця', () => {
  const src = readFileSync('app/api/telegram/plus/route.js', 'utf8');
  const ask = src.slice(src.indexOf('async function askConsent'), src.indexOf('async function continueStart'));
  assert.match(ask, /перший місяць — \$\{fmtPrice\(PRICE_FIRST\)\} грн/);
});

test('Адмінка Dityam+: «Потребує уваги» — спершу найсвіжіші', () => {
  const src = readFileSync('app/admin/plus/page.js', 'utf8');
  assert.match(src, /const attention = \[\.\.\.paused, \.\.\.stuck\]\.sort\(\(a, b\) => lastSeen\(b\) - lastSeen\(a\)\)/);
  assert.match(src, /s\.email \? `📧 \$\{s\.email\}`/);
});
