import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AGE_GROUPS, ageMatches, closingThisWeek, applyTopicFilters, splitIntro,
} from '../lib/topic-filters.js';

// Редизайн сторінки підбірки (29.09.2026, артборди Topic і TopicMobile).
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const today = '2026-09-29';

test('вік — пʼять груп сайту, як на головній, з тим самим правилом збігу', () => {
  assert.deepEqual(AGE_GROUPS.map(([v]) => v), ['0-3', '4-6', '7-11', '12-14', '15-17']);
  // Ті самі значення, що AGE_OPTS.parents у списку головної: ?age= збігається.
  const list = read('app/OpportunitiesList.js');
  for (const [v] of AGE_GROUPS) assert.ok(list.includes(`['${v}',`), `на головній немає групи ${v}`);
  assert.equal(ageMatches({ age_from: 10, age_to: 14 }, '7-11'), true);
  assert.equal(ageMatches({ age_from: 12, age_to: 14 }, '7-11'), false);
  assert.equal(ageMatches({ age_from: 0, age_to: 18 }, '15-17'), true);
});

test('«закриваються цього тижня» — дедлайн від сьогодні до +7 днів', () => {
  const items = [
    { deadline: '2026-09-29' }, { deadline: '2026-10-06' }, { deadline: '2026-10-07' },
    { deadline: '2026-09-28' }, { deadline: null }, { event_start_date: '2026-10-01' },
  ];
  assert.equal(closingThisWeek(items, today), 2);
  assert.equal(closingThisWeek([], today), 0);
});

test('фільтри рядка: тип, вік, безкоштовні, онлайн — «і» між групами', () => {
  const items = [
    { id: 1, opportunity_type: 'competition', age_from: 14, age_to: 18, cost_type: 'free', format: 'онлайн' },
    { id: 2, opportunity_type: 'competition', age_from: 6, age_to: 10, cost_type: 'paid_premium', format: 'офлайн', cities: ['Київ'] },
    { id: 3, opportunity_type: 'hackathon', age_from: 13, age_to: 17, cost_type: 'free', cities: ['Онлайн'] },
  ];
  const ids = (r) => r.map((o) => o.id);
  assert.deepEqual(ids(applyTopicFilters(items, {})), [1, 2, 3]);
  assert.deepEqual(ids(applyTopicFilters(items, { types: ['competition'] })), [1, 2]);
  assert.deepEqual(ids(applyTopicFilters(items, { age: '7-11' })), [2]);
  assert.deepEqual(ids(applyTopicFilters(items, { free: true })), [1, 3]);
  assert.deepEqual(ids(applyTopicFilters(items, { online: true })), [1, 3]);
  assert.deepEqual(ids(applyTopicFilters(items, { types: ['competition'], free: true, online: true })), [1]);
});

test('інтро: перше речення в hero, решта — у «Важливо знати», нічого не губиться', () => {
  const intro = 'Гуртки й курси, за які не треба платити: державні, від громадських організацій. Частина працює онлайн, тож долучитись можна звідусіль.';
  const { first, rest } = splitIntro(intro);
  assert.equal(first, 'Гуртки й курси, за які не треба платити: державні, від громадських організацій.');
  assert.equal(rest, 'Частина працює онлайн, тож долучитись можна звідусіль.');
  assert.equal(`${first} ${rest}`, intro);
  assert.deepEqual(splitIntro('Одне речення без крапки'), { first: 'Одне речення без крапки', rest: '' });
  assert.deepEqual(splitIntro(''), { first: '', rest: '' });
  // Лапки після крапки належать реченню.
  assert.equal(splitIntro('Тут «Кенгуру». Далі.').first, 'Тут «Кенгуру».');
});

test('сторінка підбірки: рядок цифр, канал після першого ряду, кнопка «Завантажити ще», фото в «Інших підбірках», блок організаторів', () => {
  const page = read('app/TopicPage.js');
  assert.ok(page.includes('closingThisWeek(items, todayIso)'), 'K рахується з даних, а не вигадується');
  assert.ok(page.includes('className="tp-hero-stats"'));
  assert.ok(page.includes('splitIntro(c.intro)'));
  assert.ok(page.includes('<SuggestBlock'), 'блок для організаторів');
  assert.ok(page.includes('className="tp-related-photo"'), '«Інші підбірки» з фото тем');
  assert.ok(!page.includes('tp-hero-count'), 'картки з цифрою поверх фото більше немає');
  // Кнопки в hero лишаються (рішення Марії 29.09.2026).
  assert.ok(page.includes('{ch.telegram}') && page.includes('<ShareButton'));
  const cards = read('app/topic/TopicCards.js');
  // 30.09.2026: автопродовження зняте — людина не догортала до кінця сторінки.
  assert.ok(!cards.includes('IntersectionObserver'), 'кнопка замість автопродовження');
  assert.ok(cards.includes("more: 'Завантажити ще'"), 'кнопка після перших 20');
  assert.ok(cards.includes("tgAfter.add(1)"), 'канал після першого ряду');
  assert.ok(cards.includes('is-hidden'), 'усі картки в HTML, приховані за межею — для пошуку');
  assert.ok(cards.includes('AGE_GROUPS') && cards.includes('t.onlyFree') && cards.includes('t.online'));
  assert.ok(cards.includes('trackFilterApply('), 'фільтри підбірки рахуються у воронці filter_apply');
  assert.ok(!cards.includes('plus'), 'Dityam+ у картках підбірки немає');
});
