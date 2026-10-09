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

test('лист: розбір лише для хибних, із підказками; сайт і скрипт — ті самі слова', () => {
  const py = read('scraper/olimpiada_invites.py').replace(/"\s*\n\s*(?:#[^\n]*\n\s*)*f?"/g, '');
  const entry = {
    token: '9cabd081887339b3edeadead8ffb15e2', child_name: 'Оля', score: 23, max_score: 25,
    missed_questions: [{ num: 4, id: 'v19', q: HINTS && BANK.find((q) => q.id === 'v19').q, hint: HINTS.v19, given: 2 }],
  };
  const { text, html } = buildDiploma(entry);
  assert.match(text, /Завдання 4\. Машина спочатку множить/);
  assert.ok(text.includes(`Підказка: ${HINTS.v19}`));
  assert.ok(text.includes('#rozbir'));
  assert.match(html, /Подивитися розбір на сторінці/);
  for (const phrase of [
    'Розбір: над чим варто ще подумати',
    'Нижче — завдання, де відповідь не зарахована, і підказка до кожного. ',
    'Готових відповідей немає навмисно: так дитина зможе дійти до розвʼязку сама.',
    'Ці завдання з малюнками й варіантами відповідей — на сторінці результату:',
    'Подивитися розбір на сторінці',
  ]) {
    assert.ok(text.includes(phrase) || html.includes(phrase), `сайт: ${phrase}`);
    assert.ok(py.includes(phrase), `скрипт: ${phrase}`);
  }
  // Без помилок — розділу немає.
  const clean = buildDiploma({ ...entry, score: 25, missed_questions: [] });
  assert.doesNotMatch(clean.text, /Розбір/);
});
