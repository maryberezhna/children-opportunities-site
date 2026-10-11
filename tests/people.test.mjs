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

test('адмінка: у меню рівно 3 вкладки, старі адреси не ламаються', () => {
  const nav = read('app/admin/AdminNav.js');
  const labels = [...nav.matchAll(/label: '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(labels, ['Черга', 'Звернення', 'Користувачі']);
  assert.match(read('app/admin/lyudy/page.js'), /redirect\('\/admin\/korystuvachi'\)/);
  const page = read('app/admin/korystuvachi/page.js');
  for (const h of ['Хто', 'Коли', 'Чим скористався', 'Чи купила']) assert.ok(page.includes(`>${h}</th>`), h);
  assert.doesNotMatch(page, /Dityam\+ —/);
});
