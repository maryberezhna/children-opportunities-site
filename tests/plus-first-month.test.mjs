// Перший місяць Dityam+ за 1 грн — з 08.10.2026 усім, хто ще не платив; з
// 12.10.2026 лише з олімпіади й тим, хто записався раніше (Марія: «прибрати
// з сайту перший місяць за 1 грн, щоб Dityam+ продавався одразу за 99 грн»).
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

const { firstPaymentAmount, introPriceFor, invoiceBody, PRICE, PRICE_FIRST } = await import('../lib/wayforpay.js');

test('Перший місяць: 1 грн лише тому, кому він належить', () => {
  assert.equal(PRICE_FIRST, 1);
  assert.equal(firstPaymentAmount({ plan: 'monthly', intro: true }), 1);
  assert.equal(firstPaymentAmount({ plan: 'monthly' }), null);
});

test('1 грн: з олімпіади й записані до 13.10.2026; нові з сайту — 99 грн', () => {
  assert.equal(introPriceFor({ source: 'olimpiada', created_at: '2026-11-01T10:00:00Z' }), true);
  assert.equal(introPriceFor({ source: 'site', created_at: '2026-10-10T10:00:00Z' }), true);
  assert.equal(introPriceFor({ source: 'site', created_at: '2026-10-13T10:00:00Z' }), false);
  assert.equal(introPriceFor({ source: null, created_at: null }), false);
  assert.equal(introPriceFor(null), false);
});

test('Перший місяць: хто вже платив — повна ціна', () => {
  assert.equal(firstPaymentAmount({ plan: 'monthly', paidBefore: true, intro: true }), null);
  assert.equal(firstPaymentAmount({ plan: 'halfyear', paidBefore: true, promo: { halfyear_amount: 439 } }), null);
});

test('Пів року: знижка лише за промокодом', () => {
  assert.equal(firstPaymentAmount({ plan: 'halfyear', intro: true }), null);
  assert.equal(firstPaymentAmount({ plan: 'halfyear', promo: { first_amount: 1, halfyear_amount: 439 } }), 439);
});

test('Промокод не дорожчий за пробний місяць', () => {
  assert.equal(firstPaymentAmount({ plan: 'monthly', intro: true, promo: { first_amount: 50 } }), 1);
  assert.equal(firstPaymentAmount({ plan: 'monthly', promo: { first_amount: 50 } }), 50);
});

test('Рахунок: перший платіж 1 грн, регулярний — повна ціна', () => {
  const b = invoiceBody({ unsub_token: 'tok' }, 'monthly', { firstAmount: firstPaymentAmount({ plan: 'monthly', intro: true }), now: new Date('2026-10-08T10:00:00Z') });
  assert.equal(b.amount, 1);
  assert.equal(b.regularAmount, PRICE);
});

test('Бот і перехід на оплату рахують перший платіж однією функцією', () => {
  for (const f of ['app/api/pay/start/route.js', 'app/api/telegram/plus/route.js']) {
    assert.match(readFileSync(f, 'utf8'), /firstPaymentAmount\(/, f);
    assert.match(readFileSync(f, 'utf8'), /intro: introPriceFor\(sub\)/, f);
  }
});

test('Перше повідомлення бота називає ціну: 1 грн лише тому, кому належить', () => {
  const src = readFileSync('app/api/telegram/plus/route.js', 'utf8');
  const ask = src.slice(src.indexOf('async function askConsent'), src.indexOf('async function continueStart'));
  assert.match(ask, /Перший місяць у Dityam\+ за \$\{fmtPrice\(PRICE_FIRST\)\} грн/);
  assert.match(ask, /Dityam\+ за \$\{fmtPrice\(PRICE\)\} грн\/міс/);
  assert.match(ask, /introPriceFor\(sub\)/);
  // Коротке перше повідомлення: одна кнопка «Почати», згода — рядком (09.10.2026).
  assert.match(ask, /text: 'Почати →', callback_data: 'consent:yes'/);
  assert.match(ask, /Натискаючи «Почати», ви приймаєте/);
  assert.doesNotMatch(ask, /Dityam\+ —/);
});

test('Адмінка Dityam+: одна таблиця людей замість трьох', () => {
  const src = readFileSync('app/admin/plus/page.js', 'utf8');
  assert.match(src, /peopleRows\(/);
  assert.doesNotMatch(src, /Список очікування ·/);
  assert.doesNotMatch(src, /Підписники ·/);
});
