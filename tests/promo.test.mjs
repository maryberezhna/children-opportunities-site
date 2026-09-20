// Промокоди Dityam+ (19.09.2026). Ціна за кодом `first`: місяць 1 грн
// замість 119, рік 799 замість 999 — і лише на ПЕРШИЙ платіж.
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.WAYFORPAY_MERCHANT_ACCOUNT = 'test_merchant';
process.env.WAYFORPAY_SECRET_KEY = 'test_secret';
delete process.env.WAYFORPAY_AMOUNT;
delete process.env.WAYFORPAY_AMOUNT_YEAR;
delete process.env.WAYFORPAY_AMOUNT_EARLY;

const { normalizeCode, parseStartArg, promoUsable } = await import('../lib/promo.js');
const { invoiceBody, PRICE, PRICE_YEAR } = await import('../lib/wayforpay.js');

const sub = { unsub_token: 'abc123def456', email: null, phone: '+380501112233' };
const now = new Date(2026, 8, 19, 12, 0, 0);

test('код читається як завгодно написаний', () => {
  assert.equal(normalizeCode(' FIRST '), 'first');
  assert.equal(normalizeCode('Промокод: first'), 'first');
  assert.equal(normalizeCode('first'), 'first');
});

test('не код — не код', () => {
  assert.equal(normalizeCode('а де оплатити?'), null);   // речення, а не код
  assert.equal(normalizeCode('f'), null);                 // закоротко
  assert.equal(normalizeCode('two_words'), null);         // підкреслення розділяє джерело
  assert.equal(normalizeCode(null), null);
});

test('діп-лінк несе код і джерело', () => {
  assert.deepEqual(parseStartArg('promo_first_kanal'), { code: 'first', source: 'kanal' });
  assert.deepEqual(parseStartArg('promo_first'), { code: 'first', source: 'link' });
  assert.equal(parseStartArg('waitlist_site'), null);
  assert.equal(parseStartArg(undefined), null);
});

test('термін і ліміт закривають код', () => {
  const code = { code: 'first', first_amount: 1, valid_until: '2026-09-30', max_uses: 50 };
  assert.equal(promoUsable(code, { used: 10, todayIso: '2026-09-19' }).ok, true);
  assert.equal(promoUsable(code, { used: 50, todayIso: '2026-09-19' }).reason, 'used_up');
  assert.equal(promoUsable(code, { used: 0, todayIso: '2026-10-01' }).reason, 'expired');
  assert.equal(promoUsable(null).reason, 'unknown');
  // Без обмежень код працює завжди.
  assert.equal(promoUsable({ code: 'first', first_amount: 1 }, { used: 9999 }).ok, true);
});

test('місяць за кодом: 1 грн зараз, 119 далі', () => {
  const b = invoiceBody(sub, 'monthly', { firstAmount: 1, now });
  assert.equal(b.amount, 1);
  assert.deepEqual(b.productPrice, [1]);
  assert.equal(b.regularAmount, PRICE);
  assert.equal(b.dateNext, '19.10.2026');
});

test('рік за кодом: 799 зараз, 999 через рік', () => {
  const b = invoiceBody(sub, 'yearly', { firstAmount: 799, now });
  assert.equal(b.amount, 799);
  assert.deepEqual(b.productPrice, [799]);
  assert.equal(b.regularAmount, PRICE_YEAR);
  assert.equal(b.regularMode, 'yearly');
  assert.equal(b.dateNext, '19.09.2027');
});

test('знижка не може бути більшою за ціну — «код» на 5000 грн ігнорується', () => {
  const b = invoiceBody(sub, 'monthly', { firstAmount: 5000, now });
  assert.equal(b.amount, PRICE);
  assert.equal(b.regularAmount, PRICE);
});

test('без коду нічого не змінилось', () => {
  const b = invoiceBody(sub, 'monthly', { now });
  assert.equal(b.amount, PRICE);
  assert.equal(b.regularAmount, PRICE);
  const y = invoiceBody(sub, 'yearly', { now });
  assert.equal(y.amount, PRICE_YEAR);
  assert.equal(y.regularAmount, PRICE_YEAR);
});
