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
  assert.ok(!hero.includes('variant="mobile"'), 'мобільні плитки не в хіро — вони в списку під віком');
  // 04.10.2026 три дрібні рядки стали однією великою карткою, що міняється
  // (Марія: «ми це продаємо, а зараз це тупо»). Блок лишився на тому самому
  // місці — праворуч у хіро, — тож перевіряємо його, а не стару розмітку.
  assert.ok(hero.includes('<TopWeekSlider'), '«Топ тижня» праворуч у хіро');
  assert.ok(!hero.includes('className="v2-soon-item"'), 'стара розмітка з трьох рядків прибрана');
  const page = read('app/page.js');
  assert.ok(page.includes('topWeekCards({ items: visibleFor(opportunities, today)'), 'трійка з тієї ж weekly-top, що й раніше');
  assert.ok(page.includes('id="catalog"'), 'якір, до якого прокручує пошук із хіро');
  // 05.10.2026 плитки переїхали двічі: з кінця сторінки (~17 300px, їх не
  // бачив майже ніхто) спершу в хіро, потім — одразу під вікові пігулки
  // (Марія: «"або оберіть тему" має бути під віком для дитини»). Вони йдуть у
  // список слотом afterAges, бо самі пігулки малює список.
  assert.ok(page.includes('afterAges={<HomeTopics variant="mobile" />}'),
    '«Або оберіть тему» під віком на телефоні');
  assert.ok(!page.includes('<HomeTopics variant="mobile" />\n'),
    'плиток тем окремим блоком у кінці сторінки більше немає');
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
  assert.ok(!side.includes('moreNeeds') && !side.includes('v2-side-more'), 'обставини — усі одразу, без «Ще N» (Марія, 30.09.2026)');
  assert.ok(list.includes('groupMonOlympiads(stream)'), 'олімпіади МОН — групою');
  assert.ok(list.includes('topCards.length === 3 && !sidebarLayout'), 'на десктопі головної топ лише в хіро');
  assert.ok(list.includes('className="v2-active"') && list.includes('t.clearAll'), 'активні чипи з «Очистити все» на десктопі');
  assert.ok(list.includes('className="m-bottom"') && list.includes('m-bottom-tg') && list.includes('t.filtersBtn('), 'панель знизу: Telegram-канал ліворуч, «Фільтри» праворуч (30.09.2026)');
  assert.ok(list.includes('draft.sort') && list.includes("setSort(draft.sort || 'deadline')"), 'сортування на телефоні — у шторці фільтрів');
  assert.ok(list.includes('className="m-ages"'), 'вік під пошуком на телефоні');
  assert.ok(!list.includes('className={`m-bar'), 'липкого рядка чипів угорі більше немає');
});

// Відступ перед «Або оберіть тему» на телефоні.
//
// 05.10.2026 плитки стали під вікові пігулки, і правило на 22px не подіяло:
// загальне правило контейнера має шість :not(), тобто вагу 0,8,0, а просте
// .v2-home .v2-container > .v2-topics-mobile — лише 0,3,0. На сайті лишались
// 40px (Марія: «там багато»). Тому виняток стоїть у самому списку :not().
test('плитки тем виключені із загального правила 40px', () => {
  const css = read('app/styles/home-mobile.css');
  const generic = css.match(/\.v2-home \.v2-container > :not\(\[class\^="m-"\]\)[^{]*\{\s*margin-top: 40px;/);
  assert.ok(generic, 'загального правила ритму контейнера більше немає — перевірити відступи');
  assert.match(generic[0], /:not\(\.v2-topics-mobile\)/,
    'плитки тем знову ловить правило на 40px, і власний відступ не подіє');
  assert.match(css, /\.v2-home \.v2-container > \.v2-topics-mobile \{ margin-top: 16px; \}/);
});

// 07.10.2026: фото плиток тем — лише lazy. Eager у хіро змушував телефон
// (де блок схований) тягнути ~370 КБ разом із першим екраном.
test('фото плиток тем не вантажаться примусово', () => {
  const src = readFileSync(new URL('../app/HomeTopics.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /loading=\{?['"]?eager|loading=\{variant/, 'фото плиток знову eager');
  assert.match(src, /loading="lazy"/);
});

// Марія, 07.10.2026 (скриншот: коло закривало «і» в «місці»): «прозорий фон і
// вище, десь отут» — ширше телефона наліпка стоїть після «можливості».
test('наліпка SIA — без фону, на компʼютері після першого рядка', () => {
  const css = readFileSync(new URL('../app/styles/home-v2.css', import.meta.url), 'utf8');
  const seal = css.match(/\.v2-sia-seal \{[^}]*\}/)[0];
  assert.match(seal, /background: none;/, 'у наліпки знову фон');
  assert.doesNotMatch(seal, /box-shadow/);
  assert.match(css, /@media \(min-width: 901px\) \{\s*\.v2-sia-anchor--lead \{ display: inline-block; \}\s*\.v2-sia-anchor--end \{ display: none; \}/);
  // Перед inline-block браузер може перенести рядок — останнє слово склеєне з якорем.
  const hero = readFileSync(new URL('../app/HomeHero.js', import.meta.url), 'utf8');
  assert.match(hero, /<span className="v2-sia-glue">\{leadLast\}<span className="v2-sia-anchor v2-sia-anchor--lead">/);
  assert.match(css, /\.v2-sia-glue \{\s*white-space: nowrap;/);
  // «Наче перекриває слово» (07.10.2026): у слова з кільцем — підкладка кольору фону.
  assert.match(css, /\.v2-sia-glue \{[^}]*text-shadow:[^}]*var\(--v2-halo\)/);
});
