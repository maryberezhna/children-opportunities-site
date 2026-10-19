// Сторінка /admin/lyudy і журнал оплат (Марія, 08.10.2026: «хто і скільки разів
// щось купував і підписувався на нас»).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { productOf, txKey, paidAtOf } = await import('../lib/payments.js');
const { buildPeople, peopleSummary, sourceLabel } = await import('../lib/people.js');
const read = (f) => readFileSync(f, 'utf8');

test('журнал оплат: продукт за номером замовлення', () => {
  assert.equal(productOf('abc-1791200000000-m', 1), 'plus_monthly');
  assert.equal(productOf('abc-1791200000000-h', 549), 'plus_halfyear');
  assert.equal(productOf('olimp-9cabd081887339b3edeadead8ffb15e2-1', 150), 'olimp_entry');
  assert.equal(productOf('olimp-d-9cabd081887339b3edeadead8ffb15e2-1', 199), 'olimp_print');
});

test('журнал оплат: ключ розрізняє поновлення й не задвоює повтор колбека', () => {
  assert.notEqual(txKey('abc-1-m', 1791200000), txKey('abc-1-m', 1793800000));
  assert.equal(txKey('abc-1-m', 1791200000), txKey('abc-1-m', 1791200000));
  assert.equal(paidAtOf({ processingDate: 1791200000 }), new Date(1791200000 * 1000).toISOString());
});

test('журнал пишуть колбек Dityam+ і оплати олімпіади', () => {
  assert.match(read('app/api/pay/wayforpay/route.js'), /await recordPayment\(supabase, \{/);
  const server = read('lib/olimpiada-server.js');
  assert.match(server, /product: 'olimp_entry'/);
  assert.match(server, /product: 'olimp_print'/);
  assert.match(read('app/admin/AdminNav.js'), /href: '\/admin\/korystuvachi'/);
});

test('люди: Telegram і email окремо, покупки згруповано, свіжі зверху, тест адміна — ні', () => {
  const rows = buildPeople({
    subs: [{ id: 's1', telegram_chat_id: 11, telegram_handle: '@mama', status: 'active', billing_period: 'monthly', created_at: '2026-09-25T10:00:00Z' }],
    plusWait: [{ telegram_chat_id: 11, telegram_username: '@mama', created_at: '2026-09-20T10:00:00Z' }],
    entries: [
      { child_name: 'Оля', parent_email: 'O@Example.com', created_at: '2026-10-09T10:00:00Z', paid_at: 'x', finished_at: '2026-10-09T10:40:00Z', level: 'silver' },
      { child_name: 'Тест', parent_email: 'maryberezhna@gmail.com', created_at: '2026-10-08T10:00:00Z', wfp_last_status: 'Test' },
    ],
    olimpWait: [{ email: 'maryberezhna@gmail.com', created_at: '2026-10-06T10:00:00Z' }],
    payments: [
      { product: 'plus_monthly', amount: 1, telegram_chat_id: '11', paid_at: '2026-09-25T10:00:00Z' },
      { product: 'plus_monthly', amount: 119, telegram_chat_id: '11', paid_at: '2026-10-25T10:00:00Z' },
      { product: 'olimp_print', amount: 199, email: 'o@example.com', paid_at: '2026-10-09T11:00:00Z' },
    ],
  });
  assert.deepEqual(rows.map((r) => r.who), ['@mama', '📧 o@example.com', '📧 maryberezhna@gmail.com']);
  const mama = rows[0];
  assert.equal(mama.count, 2);
  assert.equal(mama.total, 120);
  assert.deepEqual(mama.bought.map((b) => `${b.label} × ${b.count}`), ['Dityam+ · місяць × 2']);
  assert.ok(mama.notes.includes('✅ Dityam+ активна · місяць'));
  assert.ok(mama.notes.includes('📋 список очікування Dityam+'));
  assert.ok(rows[1].notes[0].startsWith('🧩 Олімпіада · Оля: пройшли тест · срібний'));
  assert.equal(rows[2].me, true);
  assert.deepEqual(rows[2].notes, ['📋 список очікування олімпіади']);
  const s = peopleSummary(rows, [{ amount: 1, paid_at: '2026-09-25T10:00:00Z' }, { amount: 119, paid_at: '2026-10-25T10:00:00Z' }], Date.parse('2026-10-26T00:00:00Z'));
  assert.deepEqual([s.people, s.buyers, s.repeat, s.total, s.total30], [2, 2, 1, 120, 119]);
});

// Ескіз Марії з блокнота (11.10.2026): вкладки «Черга · Звернення · Користувачі»,
// таблиця «Хто · Коли · Чим скористався · Чи купила», картки над нею.
test('користувачі: чим скористався і чи купила — як на ескізі', () => {
  const now = Date.parse('2026-10-11T12:00:00Z');
  const payments = [
    { product: 'plus_monthly', amount: 1, telegram_chat_id: 21, paid_at: '2026-10-01T10:00:00Z' },
    { product: 'plus_monthly', amount: 99, telegram_chat_id: 22, paid_at: '2026-10-02T10:00:00Z' },
    { product: 'olimp_print', amount: 199, email: 'print@example.com', paid_at: '2026-10-10T10:00:00Z' },
  ];
  const rows = buildPeople({
    subs: [
      { telegram_chat_id: 21, telegram_handle: 'trial', status: 'active', billing_period: 'monthly', source: 'plus_uk', created_at: '2026-10-01T09:00:00Z' },
      { telegram_chat_id: 22, telegram_handle: 'paid', status: 'active', billing_period: 'monthly', source: 'channel_deadlines', created_at: '2026-10-02T09:00:00Z' },
    ],
    entries: [
      { child_name: 'Ія', parent_email: 'free@example.com', source: 'telegram', created_at: '2026-10-11T08:00:00Z', finished_at: '2026-10-11T08:40:00Z' },
      { child_name: 'Ян', parent_email: 'print@example.com', source: 'instagram', print_paid_at: '2026-10-10T10:00:00Z', created_at: '2026-10-09T08:00:00Z' },
    ],
    payments,
  });
  const by = (who) => rows.find((r) => r.who.includes(who));
  assert.deepEqual(by('free@').used, [{ what: 'Олімпіада', paid: 'безкоштовно', bought: false }]);
  assert.deepEqual(by('print@').used, [{ what: 'Олімпіада', paid: 'замовив доставку · 199 грн', bought: true }]);
  assert.deepEqual(by('@trial').used, [{ what: 'Dityam+', paid: 'пробний місяць · 1 грн', bought: true }]);
  assert.deepEqual(by('@paid').used, [{ what: 'Dityam+', paid: '99 грн/міс', bought: true }]);
  assert.equal(by('@trial').source, 'plus_uk');

  const sum = peopleSummary(rows, payments, now);
  assert.equal(sum.new24, 1);
  assert.equal(sum.boughtPlus, 100);
  assert.equal(sum.boughtPrint, 199);
  assert.deepEqual(sum.topSources[0], ['Telegram-канал', 2]);
  assert.equal(sourceLabel(null), 'невідомо');
});

// Ескіз 11.10.2026 — три вкладки, «1 місце, де я бачу, що я написала».
// Четверта зʼявилась 19.10.2026 окремим дозволом Марії: кандидати в джерела
// лежали в базі невидимими (22 сайти без жодного рішення), і вкладкою черги
// це бути не могло — рішення про джерело не те саме, що про запис.
test('адмінка: у меню рівно 4 вкладки, старі адреси не ламаються', () => {
  const nav = read('app/admin/AdminNav.js');
  const labels = [...nav.matchAll(/label: '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(labels, ['Черга', 'Звернення', 'Користувачі', 'Джерела']);
  assert.match(read('app/admin/lyudy/page.js'), /redirect\('\/admin\/korystuvachi'\)/);
  const page = read('app/admin/korystuvachi/page.js');
  for (const h of ['Хто', 'Коли', 'Чим скористався', 'Чи купила']) assert.ok(page.includes(`>${h}</th>`), h);
  assert.doesNotMatch(page, /Dityam\+ —/);
});

// 12.10.2026, Марія: «чому тут нема посилань на сторінки» — у «Користувачах»
// людина веде в Telegram, олімпіада — на сторінку результату, джерело — на сторінку сайту.
test('люди: посилання на Telegram, результат олімпіади й сторінку-джерело', async () => {
  const { buildPeople, sourceHref } = await import('../lib/people.js');
  const rows = buildPeople({
    subs: [{ id: 1, status: 'active', telegram_handle: '@mama', telegram_chat_id: 7, created_at: '2026-10-10T10:00:00Z', source: 'plus_uk' }],
    entries: [{ token: 'abc', child_name: 'Оля', parent_email: 'M@x.ua', created_at: '2026-10-09T10:00:00Z', finished_at: '2026-10-09T10:20:00Z' },
              { token: 'nope', child_name: 'Петро', parent_email: 'm@x.ua', created_at: '2026-10-09T11:00:00Z' }],
  });
  const tg = rows.find((r) => r.key === 'tg:7');
  assert.equal(tg.handle, 'mama');
  const em = rows.find((r) => r.key === 'em:m@x.ua');
  assert.deepEqual(em.results, [{ name: 'Оля', href: '/olimpiada/test?t=abc' }]);
  assert.equal(sourceHref('plus_uk'), '/plus');
  assert.equal(sourceHref('/konkursy'), '/konkursy');
  assert.equal(sourceHref('instagram'), null);
  assert.equal(sourceHref(null), null);
});

// 14.10.2026, Марія: «а сюди ти МК не додав» (таблиця «Хто») і «тут має бути
// аналітика повністю по наших можливостях» — люди «Модного коду» теж у списку.
// Оргвнесок іде повз таблицю payments, тому сума береться з mk_entries.
test('люди: «Модний код» — у таблиці «Хто», з оплатою і без', () => {
  const rows = buildPeople({
    entries: [{ child_name: 'Оля', parent_email: 'both@example.com', created_at: '2026-10-10T10:00:00Z', finished_at: '2026-10-10T10:30:00Z' }],
    mk: [
      { child_name: 'Віка', parent_email: 'mk@example.com', amount: 99, created_at: '2026-10-13T10:00:00Z', paid_at: '2026-10-13T10:05:00Z', score: 21, max_score: 25, source: 'nashi-mozhlyvosti' },
      { child_name: 'Ніка', parent_email: 'draft@example.com', amount: 99, created_at: '2026-10-14T09:00:00Z' },
      { child_name: 'Оля', parent_email: 'both@example.com', amount: 99, created_at: '2026-10-14T10:00:00Z', paid_at: '2026-10-14T10:02:00Z' },
    ],
  });
  const paid = rows.find((r) => r.email === 'mk@example.com');
  assert.deepEqual(paid.notes, ['👗 Модний код · Віка: пройшли тест · 21/25']);
  assert.deepEqual(paid.used, [{ what: 'Модний код', paid: 'оргвнесок · 99 грн', bought: true }]);
  const draft = rows.find((r) => r.email === 'draft@example.com');
  assert.deepEqual(draft.used, [{ what: 'Модний код', paid: 'не оплатив', bought: false }]);
  assert.ok(draft.notes[0].includes('заявка без оплати'));
  // Та сама мама в олімпіаді й «Модному коді» — один рядок із двома рядками «Чим скористався».
  const both = rows.find((r) => r.email === 'both@example.com');
  assert.deepEqual(both.used.map((u) => u.what), ['Олімпіада', 'Модний код']);
  assert.ok(both.notes.some((n) => n.startsWith('🧩 Олімпіада')));
  assert.ok(both.notes.some((n) => n.includes('оплатили, тест попереду')));
});

// 15.10.2026, Марія: «здається у нас зареєструвався перший вчитель… веди облік
// в адмінці» — педагоги з olimpiada_teachers у таблиці «Хто».
test('люди: педагог олімпіади — окремий рядок з роллю', () => {
  const rows = buildPeople({
    teachers: [{ name: 'Олена', email: 'T@school.ua', source: 'olimpiada', created_at: '2026-10-15T07:53:14Z', thanks_sent_at: '2026-10-15T07:53:14Z' }],
  });
  const t = rows.find((r) => r.email === 't@school.ua');
  assert.equal(t.role, '👩‍🏫 вчитель');
  assert.deepEqual(t.notes, ['👩‍🏫 Педагог олімпіади · Олена · подяку надіслано']);
  assert.equal(t.source, 'olimpiada');
});

