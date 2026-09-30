import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { groupMonOlympiads, subjectLabel, MON_GROUP } from '../lib/olympiad-group.js';

// Редизайн головної (29.09.2026, артборди Main і Mobile).
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

const mon = (n, slug) => ({ id: slug, slug, title: `Всеукраїнська олімпіада з ${n}`, opportunity_type: 'olympiad', cost_type: 'free' });
const other = (slug) => ({ id: slug, slug, title: 'Конкурс', opportunity_type: 'competition' });

test('олімпіади МОН — одна група на місці найближчої, решта стрічки як була', () => {
  const stream = [other('a'), mon('фізики', 'f'), other('b'), mon('хімії', 'h'), mon('історії', 'i'), other('c')];
  const out = groupMonOlympiads(stream);
  assert.deepEqual(out.map((e) => e.group || e.id), ['a', MON_GROUP, 'b', 'c']);
  assert.equal(out[1].items.length, 3);
  assert.deepEqual(out[1].items.map((o) => o.id), ['f', 'h', 'i']);
});

test('одна олімпіада групою не стає; міжнародні й МАН — не олімпіади МОН', () => {
  const one = [other('a'), mon('фізики', 'f')];
  assert.deepEqual(groupMonOlympiads(one).map((e) => e.id), ['a', 'f']);
  const intl = [
    { id: 'x', title: 'Міжнародна біологічна олімпіада', opportunity_type: 'olympiad' },
    { id: 'y', title: 'Олімпіада МАН з філософії', opportunity_type: 'olympiad' },
    mon('хімії', 'h'), mon('фізики', 'f'),
  ];
  const out = groupMonOlympiads(intl);
  assert.deepEqual(out.map((e) => e.group || e.id), ['x', 'y', MON_GROUP]);
  assert.deepEqual(groupMonOlympiads([]), []);
});

test('підпис предмета — без «Всеукраїнська олімпіада»', () => {
  assert.equal(subjectLabel(mon('фізичної культури', 'f')), 'з фізичної культури');
  assert.equal(subjectLabel({ title: 'Щось інше' }), 'Щось інше');
});

test('хіро: без фото й цифр, пошук шле подію в список, трійка рахується на сервері', () => {
  const hero = read('app/HomeHero.js');
  assert.ok(!hero.includes('<picture'), 'фото з хіро знято (рішення Марії 29.09.2026)');
  assert.ok(!hero.includes('v2-stats'), 'великих цифр у хіро немає');
  assert.ok(hero.includes("export const HERO_SEARCH_EVENT = 'dityam:search'"));
  assert.ok(!hero.includes('v2-trust'), 'рядка довіри з числом у хіро немає — число вже над списком (30.09.2026)');
  assert.ok(!hero.includes('звіряємо'), 'без «кожну звіряємо» (рішення Марії 29.09.2026)');
  assert.ok(hero.includes('<HomeTopics'), 'шість плиток тем у хіро');
  assert.ok(hero.includes('className="v2-soon"'), '«Встигніть цього тижня» праворуч');
  const page = read('app/page.js');
  assert.ok(page.includes('topWeekCards({ items: visibleFor(opportunities, today)'), 'трійка з тієї ж weekly-top, що й раніше');
  assert.ok(page.includes('id="catalog"'), 'якір, до якого прокручує пошук із хіро');
  assert.ok(page.includes('<HomeTopics variant="mobile"'), '«Або оберіть тему» на телефоні');
  const list = read('app/OpportunitiesList.js');
  assert.ok(list.includes('window.addEventListener(HERO_SEARCH_EVENT'), 'список слухає пошук із хіро');
});

test('список: сортування, фільтри лише в панелі у заданому порядку, група олімпіад, панель знизу', () => {
  const list = read('app/OpportunitiesList.js');
  for (const s of ["useState('deadline')", "p.get('sort') === 'new'", "next.set('sort', sort)", "sort !== 'new'"]) {
    assert.ok(list.includes(s), `сортування: немає ${s}`);
  }
  const side = list.slice(list.indexOf('const needOpts = needList'), list.indexOf('const searchInput = (extra'));
  const order = ['sideGroup(\'age\'', 'sideGroup(\'deadline\'', 'sideGroup(\'cost\'', 'id="v2-side-place"', 'sideGroup(\'type\'', 'id="v2-side-need"']
    .map((k) => side.indexOf(k));
  assert.ok(order.every((i) => i >= 0), 'у панелі бракує групи');
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'порядок: вік → дедлайн → вартість → де → тип → особлива потреба');
  assert.ok(!side.includes('v2-side-search'), 'пошуку в панелі немає — він у хіро');
  assert.ok(side.includes('NEEDS_SHOWN = 5') && side.includes('t.moreNeeds('), 'обставини: перші 5 і «Ще N»');
  assert.ok(list.includes('groupMonOlympiads(stream)'), 'олімпіади МОН — групою');
  assert.ok(list.includes('topCards.length === 3 && !sidebarLayout'), 'на десктопі головної топ лише в хіро');
  assert.ok(list.includes('className="v2-active"') && list.includes('t.clearAll'), 'активні чипи з «Очистити все» на десктопі');
  assert.ok(list.includes('className="m-bottom"') && list.includes('t.filtersBtn(') && list.includes('t.sortBtn'), 'панель «Фільтри / Сортування» на телефоні');
  assert.ok(list.includes('className="m-ages"'), 'вік під пошуком на телефоні');
  assert.ok(!list.includes('className={`m-bar'), 'липкого рядка чипів угорі більше немає');
});
