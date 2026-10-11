// Розбір після тесту (Марія, 09.10.2026: «додай розбір помилок у імейл тим,
// хто проходить тест, дуже обережно»; «ми не пишемо підказки в тесті»; «лише
// на сторінці диплому і в імейлі там, де дитина помилилася»; «підказка без
// відповіді»). Регресії, проти яких стоїть тест:
// - у розбір потрапляє правильна відповідь або завдання, яке дитина розвʼязала;
// - підказки потрапляють у тест (у браузер до здачі);
// - лист із сайту й запасний скрипт розходяться.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

process.env.WAYFORPAY_MERCHANT_ACCOUNT = 'm';
process.env.WAYFORPAY_SECRET_KEY = 's';
const { BANK } = await import('../content/olimpiada/lohika-9-11.js');
const { HINTS } = await import('../content/olimpiada/hints.js');
const { missedQuestions } = await import('../lib/olimpiada.js');
const { buildDiploma } = await import('../lib/olimpiada-mail.js');
const read = (f) => readFileSync(f, 'utf8');

test('підказка є до кожного завдання й не порожня', () => {
  for (const q of BANK) assert.ok(String(HINTS[q.id] || '').trim().length > 20, q.id);
  assert.equal(Object.keys(HINTS).length, BANK.length);
});

test('розбір: лише хибні й пропущені, номери як у дитини, без правильної відповіді', () => {
  const bank = [
    { id: 'a', q: 'A?', options: ['1', '2', '3', '4'] },
    { id: 'b', q: 'B?', options: ['1', '2', '3', '4'] },
    { id: 'c', q: 'C?', options: ['1', '2', '3', '4'] },
  ];
  const order = [{ id: 'c', options: [0, 1, 2, 3] }, { id: 'a', options: [0, 1, 2, 3] }, { id: 'b', options: [0, 1, 2, 3] }];
  const keys = { a: 1, b: 2, c: 0 };
  const answers = { a: 1, b: 3 }; // a — правильно, b — хибно, c — без відповіді
  const out = missedQuestions(bank, order, answers, keys, { b: 'hint-b', c: 'hint-c' });
  assert.deepEqual(out, [
    { num: 1, id: 'c', q: 'C?', hint: 'hint-c', given: null },
    { num: 3, id: 'b', q: 'B?', hint: 'hint-b', given: 3 },
  ]);
  for (const m of out) assert.deepEqual(Object.keys(m).sort(), ['given', 'hint', 'id', 'num', 'q']);
  assert.deepEqual(missedQuestions(bank, order, { a: 1, b: 2, c: 0 }, keys), []);
});

test('підказки не йдуть у тест: їх читають лише серверні файли', () => {
  const files = [];
  const walk = (d) => readdirSync(d).forEach((f) => {
    const p = path.join(d, f);
    if (statSync(p).isDirectory()) walk(p); else if (/\.(js|mjs|jsx)$/.test(f)) files.push(p);
  });
  walk('app'); walk('lib');
  const users = files.filter((f) => /content\/olimpiada\/hints/.test(read(f))).sort();
  assert.deepEqual(users, ['app/api/olimpiada/submit/route.js', 'app/olimpiada/test/page.js']);
  for (const f of users) assert.doesNotMatch(read(f), /^\s*['"]use client['"]/m, f);
  assert.doesNotMatch(read('app/olimpiada/test/TestRunner.js'), /hints|missed_questions|BANK/);
  assert.match(read('app/api/olimpiada/submit/route.js'), /missed_questions: missed/);
  assert.match(read('app/olimpiada/test/page.js'), /id="rozbir"/);
});

test('лист без розбору — він лише на сторінці результату (11.10.2026)', () => {
  // Марія: «розбір має бути видно тільки на сторінці результатів»; у листі —
  // «Відкрити диплом», друкований диплом і Dityam+ за 1 грн.
  const py = read('scraper/olimpiada_invites.py');
  const entry = {
    token: '9cabd081887339b3edeadead8ffb15e2', child_name: 'Оля', score: 22, max_score: 25,
    missed_questions: [{ num: 4, id: 'v19', q: BANK.find((q) => q.id === 'v19').q, hint: HINTS.v19, given: 2 }],
  };
  const { text, html } = buildDiploma(entry);
  for (const part of [text, html]) {
    assert.doesNotMatch(part, /Розбір|Підказка|#rozbir/);
    assert.ok(!part.includes(HINTS.v19));
  }
  assert.match(html, /Відкрити диплом/);
  assert.match(text, /Бажаєте друкований диплом\?/);
  assert.match(html, /Спробувати Dityam\+ за 1 грн/);
  assert.doesNotMatch(py, /missed_questions|Розбір: над чим/);
});
