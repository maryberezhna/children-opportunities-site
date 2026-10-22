// Нагадування про «Обкладинку місяця» (13.10.2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Свої пошти й chat_id — зі змінних оточення (репозиторій публічний, 22.10.2026);
// у тесті — вигадані, задаються ДО імпорту модуля.
process.env.OWN_EMAILS = 'owner@example.com,owner.two@example.com';
process.env.OWN_CHAT_IDS = '111222333';
const { prevMonthKey, candidates, buildMessage } = await import('../scripts/mk-winner-reminder.mjs');

test('попередній місяць за київським часом, і через Новий рік', () => {
  assert.equal(prevMonthKey(new Date('2026-11-01T08:00:00Z')), '2026-10');
  assert.equal(prevMonthKey(new Date('2027-01-05T08:00:00Z')), '2026-12');
});

test('кандидати: лише обкладинки місяця, без тестів, повернень і Марії; спершу найвищі бали', () => {
  const base = { look_at: '2026-10-20T10:00:00Z', finished_at: '2026-10-20T09:00:00Z', refunded_at: null, source: 'page' };
  const rows = [
    { ...base, token: 'a', child_name: 'А', score: 18 },
    { ...base, token: 'b', child_name: 'Б', score: 24 },
    { ...base, token: 'c', child_name: 'В', score: 25, source: 'admin_test' },
    { ...base, token: 'd', child_name: 'Г', score: 25, parent_email: 'owner.two@example.com' },
    { ...base, token: 'e', child_name: 'Ґ', score: 25, refunded_at: '2026-10-21T00:00:00Z' },
    { ...base, token: 'f', child_name: 'Д', score: 25, finished_at: '2026-11-01T10:00:00Z' },
  ];
  assert.deepEqual(candidates(rows, '2026-10').map((r) => r.token), ['b', 'a']);
});

test('повідомлення: місяць, строк, кандидати; без емодзі, які Telegram показує кодом', () => {
  const msg = buildMessage([{ token: 'x', child_name: 'Соля <b>', child_age: 11, score: 24, max_score: 25, look_title: 'Осінь' }], '2026-10');
  assert.match(msg, /жовтень 2026/);
  assert.match(msg, /до 7 листопада/);
  assert.match(msg, /Соля &lt;b&gt;, 11 · <b>24\/25<\/b> · «Осінь»/);
  assert.doesNotMatch(msg, /[\u{1F300}-\u{1F3FF}]/u);
});
