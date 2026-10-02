// Суми в рахунку WayForPay. Регресія, проти якої стоїть тест: знижений перший
// платіж (за промокодом — 1 грн) не сміє стати ціною регулярних списань — без
// явного regularAmount WayForPay бере його з amount, і людину щомісяця
// списували б по 1 грн.
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.WAYFORPAY_MERCHANT_ACCOUNT = 'test_merchant';
process.env.WAYFORPAY_SECRET_KEY = 'test_secret';
delete process.env.WAYFORPAY_AMOUNT;
delete process.env.WAYFORPAY_AMOUNT_HALF;
delete process.env.WAYFORPAY_AMOUNT_EARLY;

const { invoiceBody, tokenFromOrderRef, periodFromOrderRef, describeFailure, FAILED_STATUSES, payStartUrl, failureStopsSubscription, failureAdviceForPerson, accessLine, isOurOrderRef, PRICE, PRICE_HALF } = await import('../lib/wayforpay.js');
const { readFileSync } = await import('node:fs');

const sub = { unsub_token: 'abc123def456', email: null, phone: '+380501112233' };
const now = new Date(2026, 8, 14, 12, 0, 0);   // 14.09.2026

test('ціни за замовчуванням — 119 / 549 за пів року', () => {
  assert.equal(PRICE, 119);
  assert.equal(PRICE_HALF, 549);
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

// Пів року замість року (Марія, 24.09.2026). Режим WayForPay `halfyearly` —
// «раз на півроку» (https://wiki.wayforpay.com/view/852102).
test('пів року без промокоду — повна ціна, списання раз на пів року', () => {
  const b = invoiceBody(sub, 'halfyear', { now });
  assert.equal(b.amount, 549);
  assert.equal(b.regularAmount, 549);
  assert.equal(b.regularMode, 'halfyearly');
  assert.equal(b.dateNext, '14.03.2027');
  assert.deepEqual(b.productName, ['Підписка Dityam+ (пів року)']);
});

test('річну більше не створюємо: «yearly» — це місяць', () => {
  const b = invoiceBody(sub, 'yearly', { now });
  assert.equal(b.regularMode, 'monthly');
  assert.equal(b.regularAmount, 119);
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

// З промокодом перший довгий платіж менший за звичайну ціну (439 < 549).
// Колбек визначав період за сумою й записував таку підписку «місячною»
// (22.09.2026, тоді ще з річною) — тож період живе в номері замовлення.
test('пів року з промокодом — пів року, а не місяць', () => {
  const h = invoiceBody(sub, 'halfyear', { firstAmount: 439, now });
  const m = invoiceBody(sub, 'monthly', { firstAmount: 1, now });
  assert.equal(tokenFromOrderRef(h.orderReference), sub.unsub_token);
  assert.match(h.orderReference, /-h$/);
  assert.equal(periodFromOrderRef(h.orderReference, h.amount), 'halfyear');
  assert.equal(periodFromOrderRef(m.orderReference, m.amount), 'monthly');
});

test('старі річні номери замовлень (`-y`) досі впізнаються як річні', () => {
  assert.equal(periodFromOrderRef('abc123def456-1789900000000-y', 799), 'yearly');
});

test('старі номери замовлень без позначки — за сумою', () => {
  assert.equal(periodFromOrderRef('abc123def456-1789900000000', 549), 'halfyear');
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
  assert.match(payStartUrl('t', 'halfyear'), /plan=halfyear$/);
  assert.match(payStartUrl('t', 'yearly'), /plan=monthly$/);
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

// Чи невдача зупиняє підписку. Регресія, проти якої стоять ці тести: 24.09.2026
// перша підписниця Dityam+ заплатила об 11:56, а о 12:12 прийшов Declined 1124
// від ІНШОГО, покинутого рахунку — і колбек зняв її з active у paused+free.
// Колбек шукав людину за unsub_token і не дивився, про який рахунок ідеться.
const LIVE = '638f707a19d7d2299df51ce5f2d66a9c-1790250913830-m';
const ABANDONED = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-1790250999999-m';

test('покинутий рахунок НЕ знімає оплачену підписку', () => {
  assert.equal(
    failureStopsSubscription({ status: 'active', storedRef: LIVE, failedRef: ABANDONED }),
    false,
  );
});

test('невдача на власному рахунку підписку зупиняє', () => {
  assert.equal(failureStopsSubscription({ status: 'active', storedRef: LIVE, failedRef: LIVE }), true);
  // WayForPay може дослати спробу з суфіксом до того самого номера.
  assert.equal(failureStopsSubscription({ status: 'active', storedRef: LIVE, failedRef: `${LIVE}#2` }), true);
});

test('невдале регулярне списання зупиняє: номер не нашого вигляду', () => {
  assert.equal(
    failureStopsSubscription({ status: 'active', storedRef: LIVE, failedRef: 'WFP-REGULAR-55512' }),
    true,
  );
});

test('ще не підписник — пауза як і раніше', () => {
  assert.equal(failureStopsSubscription({ status: 'pending', storedRef: null, failedRef: ABANDONED }), true);
  assert.equal(failureStopsSubscription({ status: 'paused', storedRef: null, failedRef: ABANDONED }), true);
  // Активна без збереженого номера: звіряти нічим, поводимось обережно.
  assert.equal(failureStopsSubscription({ status: 'active', storedRef: null, failedRef: ABANDONED }), true);
});

test('isOurOrderRef впізнає лише наші номери', () => {
  assert.equal(isOurOrderRef(LIVE), true);
  assert.equal(isOurOrderRef('638f707a19d7d2299df51ce5f2d66a9c-1790250913830'), true);
  assert.equal(isOurOrderRef('638f707a19d7d2299df51ce5f2d66a9c-1790250913830-h'), true);
  assert.equal(isOurOrderRef('WFP-REGULAR-55512'), false);
  assert.equal(isOurOrderRef(''), false);
  assert.equal(isOurOrderRef(null), false);
});


// --- людині теж треба сказати, 02.10.2026 ---
//
// Доти при невдалій оплаті сповіщення йшло ЛИШЕ в адмінчат. Людина проходила
// всю анкету, тиснула «Оплатити», банк відмовляв — і далі тиша. 24.09.2026 так
// сталося з першою людиною, що дійшла до оплати Dityam+.
test('повернення не називаємо невдалою оплатою', () => {
  // Сказати «оплата не пройшла», коли ми ЇЙ ПОВЕРНУЛИ гроші, — збрехати в
  // найгіршу мить. Такі статуси людині не пишемо зовсім.
  for (const status of ['Refunded', 'Voided', 'RefundInProcessing']) {
    assert.equal(failureAdviceForPerson({ status }), null, status);
  }
});

test('картка — порада спробувати іншою', () => {
  for (const code of [1101, 1103, 1104, 1105, 1108]) {
    const a = failureAdviceForPerson({ status: 'Declined', reasonCode: code });
    assert.equal(a.kind, 'card', String(code));
    assert.match(a.text, /карткою|картки/);
  }
});

test('не довершили — рахунок просто збіг', () => {
  for (const f of [{ status: 'Declined', reasonCode: 1124 }, { status: 'Expired' },
                   { status: 'Declined', reasonCode: 1125 }]) {
    assert.equal(failureAdviceForPerson(f).kind, 'unfinished', JSON.stringify(f));
  }
});

test('наш бік — людина не винна, і ми цього не приховуємо', () => {
  const a = failureAdviceForPerson({ status: 'Declined', reasonCode: 1118 });
  assert.equal(a.kind, 'ours');
  assert.match(a.text, /на нашому боці/);
});

test('причина невідома — не вигадуємо її', () => {
  const a = failureAdviceForPerson({ status: 'SomethingNew' });
  assert.equal(a.kind, 'unknown');
  assert.match(a.text, /банк не повідомив/);
});

// Правила Марії для текстів до людини.
test('у тексті людині немає ні коду, ні дефіциту, ні виправдань про гроші', () => {
  const texts = [
    failureAdviceForPerson({ status: 'Declined', reasonCode: 1104 }).text,
    failureAdviceForPerson({ status: 'Expired' }).text,
    failureAdviceForPerson({ status: 'Declined', reasonCode: 1118 }).text,
    failureAdviceForPerson({ status: 'X' }).text,
  ];
  for (const t of texts) {
    assert.doesNotMatch(t, /\d{4}/, `код у тексті: ${t}`);
    assert.doesNotMatch(t, /єдина|єдиний|перша, хто|ніхто/i, `дефіцит: ${t}`);
    assert.doesNotMatch(t, /не платний|нічого не продаємо/i, `виправдання: ${t}`);
    assert.ok(t.length > 40 && t.length < 400, `дивна довжина: ${t.length}`);
  }
});

// Головне: щоб виклик узагалі був. Саме його відсутність і була дірою —
// функція ніколи б не спрацювала, якби колбек її не кликав.
test('колбек оплати пише людині, а не лише адміну', () => {
  const src = readFileSync(new URL('../app/api/pay/wayforpay/route.js', import.meta.url), 'utf8');
  assert.match(src, /failureAdviceForPerson\(/, 'поради для людини не викликано');
  assert.match(src, /makeBot\(PLUS_TOKEN\)/, 'пишемо не тим ботом, у якому сидить людина');
  // Нове посилання обовʼязкове: рахунок живе годину, старий уже мертвий.
  assert.match(src, /payStartUrl\(token/, 'немає свіжого посилання на оплату');
});

test('у текстах «картка», а не «карта»', () => {
  for (const f of [{ status: 'Declined', reasonCode: 1104 },
                   { status: 'Declined', reasonCode: 1118 }]) {
    const t = failureAdviceForPerson(f).text;
    assert.doesNotMatch(t, /\bкарт(а|ою|и|у)\b/, `«карта» замість «картка»: ${t}`);
  }
});

test('«не завершено» не називаємо «не пройшла»', () => {
  const a = failureAdviceForPerson({ status: 'Expired' });
  assert.equal(a.title, 'Оплату не завершено');
  assert.doesNotMatch(a.text, /не пройшла/);
});

// --- зірване продовження: людина мала доступ і втратила його ---
//
// 02.10.2026, одразу після того, як почали писати людині: для того, хто вже
// платив, «спробуйте ще раз» — не вся правда. Його підписка в цю мить стала
// paused, і найважливіше для нього не причина, а що добірки спинились.
test('продовження зірвалось — кажемо, що підписка на паузі', () => {
  const line = accessLine(true);
  assert.match(line, /на паузі/);
  assert.match(line, /не надсилаємо/);
});

test('перша оплата — про втрату доступу не пишемо', () => {
  // Доступу й не було, тож «підписка на паузі» лише злякало б без причини.
  assert.equal(accessLine(false), null);
});

test('рядок про доступ не припускає одну дитину', () => {
  // У профілі Dityam+ дітей може бути кілька.
  assert.doesNotMatch(accessLine(true), /вашої дитини|вашій дитині/);
});

test('колбек розрізняє першу оплату й продовження', () => {
  const src = readFileSync(new URL('../app/api/pay/wayforpay/route.js', import.meta.url), 'utf8');
  assert.match(src, /accessLine\(existing\?\.status === 'active'\)/,
    'рядок про доступ не привʼязаний до того, чи підписка була активна');
});
