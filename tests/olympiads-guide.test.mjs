// Путівник /olimpiady веде далі: предмет → його картка (04.10.2026).
//
// Навіщо. ~230 переходів із Google на тиждень, але 1,6 сторінки за сеанс,
// до кінця догортали 9 із 274. Хто йшов далі — відкривав картку свого
// предмета, а назви в таблиці були простим текстом. Тепер і чип у хіро, і
// назва в таблиці ведуть на живу картку — якщо вона є. Вгаданого посилання
// не буває: краще текст, ніж картка іншого предмета.
//
// Тест стереже пари, які легко сплутати за основою слова, і те, що на
// сторінці не повертається слово «каталог» (платформа, не каталог).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { subjectOf, subjectCards, subjectChip, SUBJECTS } = await import('../lib/olympiads.js');

const olympiad = (title, slug = title) => ({ opportunity_type: 'olympiad', title, slug });
const of = (title) => subjectOf(olympiad(title));

// Живі картки олімпіад МОН станом на 04.10.2026 — назви й slug дослівно з бази.
const LIVE = [
  ['vseukrainska-olimpiada-z-angliiskoi-movi-6df066', 'Всеукраїнська олімпіада з англійської мови'],
  ['vseukrainska-olimpiada-z-astronomii-d2f1ff', 'Всеукраїнська олімпіада з астрономії'],
  ['vseukrainska-olimpiada-z-biologii-1f56f0', 'Всеукраїнська олімпіада з біології'],
  ['vseukrainska-olimpiada-z-bolharskoi-movy-ta-literatury', 'Всеукраїнська олімпіада з болгарської мови та літератури'],
  ['vseukrainska-olimpiada-z-heohrafii-416995', 'Всеукраїнська олімпіада з географії'],
  ['vseukrainska-olimpiada-z-informatyky-a3aef8', 'Всеукраїнська олімпіада з інформатики'],
  ['vseukrainska-olimpiada-z-informatsiinykh-tekhnolohii', 'Всеукраїнська олімпіада з інформаційних технологій'],
  ['vseukrainska-olimpiada-z-ispanskoi-movi-c545e4', 'Всеукраїнська олімпіада з іспанської мови'],
  ['vseukrainska-olimpiada-z-istorii-ukrainy-dbb65b', 'Всеукраїнська олімпіада з історії України'],
  ['vseukrainska-olimpiada-z-krymskotatarskoi-movy-ta-literatury', 'Всеукраїнська олімпіада з кримськотатарської мови та літератури'],
  ['vseukrainska-olimpiada-z-movy-ivryt-ta-ievreiskoi-literatury', 'Всеукраїнська олімпіада з мови іврит та єврейської літератури'],
  ['vseukrainska-olimpiada-z-nimetskoi-movi-0ab62c', 'Всеукраїнська олімпіада з німецької мови'],
  ['vseukrainska-olimpiada-z-novohretskoi-movy-ta-literatury', 'Всеукраїнська олімпіада з новогрецької мови та літератури'],
  ['vseukrainska-olimpiada-z-polskoi-movi-e50c27', 'Всеукраїнська олімпіада з польської мови'],
  ['vseukrainska-olimpiada-z-pravoznavstva-6e61c1', 'Всеукраїнська олімпіада з правознавства'],
  ['vseukrainska-olimpiada-z-rumunskoi-movy-ta-literatury', 'Всеукраїнська олімпіада з румунської мови та літератури'],
  ['vseukrainska-olimpiada-z-uhorskoi-movy-ta-literatury', 'Всеукраїнська олімпіада з угорської мови та літератури'],
  ['vseukrainska-olimpiada-z-ukrainskoi-movi-ta-literaturi-13a7bc', 'Всеукраїнська олімпіада з української мови та літератури'],
  ['vseukrainska-olimpiada-z-fizyky-a09d23', 'Всеукраїнська олімпіада з фізики'],
  ['vseukrainska-olimpiada-z-filosofii-8f7a99', 'Всеукраїнська олімпіада з філософії'],
  ['vseukrainska-olimpiada-z-frantsuzkoi-movi-862ccb', 'Всеукраїнська олімпіада з французької мови'],
  ['vseukrainska-olimpiada-z-khimii-053aab', 'Всеукраїнська олімпіада з хімії'],
  ['vseukrainska-olimpiada-z-cheskoi-movy-ta-literatury', 'Всеукраїнська олімпіада з чеської мови та літератури'],
  ['vseukrainska-olimpiada-zi-slovatskoi-movy-ta-literatury', 'Всеукраїнська олімпіада зі словацької мови та літератури'],
].map(([slug, title]) => olympiad(title, slug));

test('пари, які легко сплутати, розведені', () => {
  // Інформатика ≠ інформаційні технології.
  assert.equal(of('Всеукраїнська олімпіада з інформатики'), 'Інформатика');
  assert.equal(of('Всеукраїнська олімпіада з інформаційних технологій'), 'Інформаційні технології');
  // Українська мова — не будь-яка «мова та література», і не «Всеукраїнська» в назві.
  assert.equal(of('Всеукраїнська олімпіада з української мови та літератури'), 'Українська мова та література');
  assert.equal(of('Всеукраїнська олімпіада з угорської мови та літератури'), 'Угорська мова та література');
  assert.equal(of('Всеукраїнська олімпіада зі словацької мови та літератури'), 'Словацька мова та література');
  assert.equal(of('Всеукраїнська олімпіада з польської мови'), 'Польська мова та література');
  assert.equal(of('Всеукраїнська олімпіада з мови іврит та єврейської літератури'), 'Мова іврит та єврейська література');
  // «Історія України» — це історія, і «України» не робить її українською мовою.
  assert.equal(of('Всеукраїнська олімпіада з історії України'), 'Історія');
  assert.equal(of('Всеукраїнська олімпіада з правознавства'), 'Правознавство');
  // Фізика ≠ фізична культура, хімія ≠ біохімія.
  assert.equal(of('Всеукраїнська олімпіада з фізики'), 'Фізика');
  assert.equal(of('Всеукраїнська олімпіада з фізичної культури'), null);
  assert.equal(of('Всеукраїнська олімпіада з біохімії'), null);
});

test('немає певності — немає предмета', () => {
  // Два предмети в одній назві — не вгадуємо.
  assert.equal(of('Всеукраїнська олімпіада з історії та правознавства'), null);
  // Не з наказу: філософія (МАН), штучний інтелект, початкова школа.
  assert.equal(of('Всеукраїнська олімпіада з філософії'), null);
  assert.equal(of('Всеукраїнська олімпіада зі штучного інтелекту (UOAI 2026)'), null);
  assert.equal(of('Всеукраїнська олімпіада з математики (початкова школа)'), null);
  assert.equal(of('Всеукраїнська олімпіада з укр. мови (початкова школа)'), null);
  // Не олімпіада МОН.
  assert.equal(of('Міжнародна олімпіада з фізики'), null);
  assert.equal(subjectOf({ opportunity_type: 'competition', title: 'Всеукраїнська олімпіада з хімії' }), null);
  assert.equal(subjectOf(null), null);
  assert.equal(subjectOf({}), null);
});

test('кожен предмет наказу впізнається у власній назві', () => {
  for (const s of SUBJECTS) {
    assert.equal(of(`Всеукраїнська олімпіада з предмета «${s.name}»`), s.name, s.name);
    assert.ok(subjectChip(s.name), `${s.name}: підпис чипа`);
  }
  assert.equal(subjectChip('Англійська мова'), 'Англійська');
  assert.equal(subjectChip('Мова іврит та єврейська література'), 'Іврит');
});

test('живі картки з бази: 23 предмети, математики без картки немає', () => {
  const cards = subjectCards(LIVE);
  assert.equal(cards.size, 23);
  assert.equal(cards.get('Англійська мова'), 'vseukrainska-olimpiada-z-angliiskoi-movi-6df066');
  assert.equal(cards.get('Фізика'), 'vseukrainska-olimpiada-z-fizyky-a09d23');
  assert.equal(cards.get('Історія'), 'vseukrainska-olimpiada-z-istorii-ukrainy-dbb65b');
  assert.equal(cards.get('Інформатика'), 'vseukrainska-olimpiada-z-informatyky-a3aef8');
  assert.equal(cards.get('Інформаційні технології'), 'vseukrainska-olimpiada-z-informatsiinykh-tekhnolohii');
  assert.equal(cards.get('Українська мова та література'), 'vseukrainska-olimpiada-z-ukrainskoi-movi-ta-literaturi-13a7bc');
  assert.equal(cards.get('Словацька мова та література'), 'vseukrainska-olimpiada-zi-slovatskoi-movy-ta-literatury');
  // Математика в базі закрита — посилання немає, назва лишається текстом.
  assert.equal(cards.has('Математика'), false);
  // Порядок — як у таблиці.
  const order = SUBJECTS.map((s) => s.name).filter((n) => cards.has(n));
  assert.deepEqual([...cards.keys()], order);
});

test('дві картки на предмет — перша; без slug — без посилання', () => {
  const cards = subjectCards([
    olympiad('Всеукраїнська олімпіада з хімії', 'first'),
    olympiad('Всеукраїнська олімпіада з хімії', 'second'),
    { opportunity_type: 'olympiad', title: 'Всеукраїнська олімпіада з фізики' },
  ]);
  assert.equal(cards.get('Хімія'), 'first');
  assert.equal(cards.has('Фізика'), false);
  assert.equal(subjectCards(null).size, 0);
});

// Сторінка тягне CSS, тож на голому node її не імпортуєш — читаємо текстом.
const page = readFileSync(new URL('../app/olimpiady/page.js', import.meta.url), 'utf8');

test('сторінка: назва в таблиці й чипи ведуть на картку', () => {
  assert.match(page, /subjectCards\(items\)/);
  // Назва предмета в рядку таблиці — посилання, коли картка є, інакше текст.
  assert.match(page, /<th scope="row">\s*\{cards\.has\(s\.name\)\s*\? <Link href=\{cardHref\(s\.name\)\} prefetch=\{false\}>\{s\.name\}<\/Link>\s*: s\.name\}/);
  assert.match(page, /const cardHref = \(name\) => `\/o\/\$\{cards\.get\(name\)\}`/);
  // Чипи в хіро — ПІСЛЯ кнопок: канал — головний заклик сайту, і на телефоні
  // 23 чипи над кнопкою зсували її за перший екран.
  const hero = page.slice(page.indexOf('className="tp-actions"'), page.indexOf('className="tp-hero-photo"'));
  assert.ok(hero.indexOf('Отримувати нові в Telegram') < hero.indexOf('className="ol-pick"'), 'чипи — після кнопки каналу');
  assert.match(hero, /className="ol-pick-link"/);
  assert.match(hero, /subjectChip\(name\)/);
  assert.ok(!page.slice(0, page.indexOf('className="tp-actions"')).includes('className="ol-pick"'), 'над кнопками чипів немає');
});

test('телефон: чипи предметів — один рядок із прокруткою всередині себе', () => {
  const css = readFileSync(new URL('../app/styles/topic-v2.css', import.meta.url), 'utf8');
  const at = css.indexOf('@media (max-width: 640px)');
  assert.ok(at > 0, 'немає мобільного блоку для чипів');
  const block = css.slice(at, css.indexOf('\n}', at));
  assert.match(block, /\.ol-pick-subjects \{[^}]*flex-wrap: nowrap/);
  assert.match(block, /\.ol-pick-subjects \{[^}]*overflow-x: auto/);
  // Смуга виходить рівно на поля .tp-main (16px) — ширша дала б прокрутку сторінці.
  assert.match(block, /margin: 0 -16px/);
  assert.match(css, /\.tp-main \.ol-pick-link \{[^}]*min-height: 44px/);
});

test('сторінка: «Що далі» під таблицею, нічого не знято', () => {
  const at = (s) => page.indexOf(s);
  assert.ok(at('id="ol-next"') > at('id="ol-subjects"'), '«Що далі» — після таблиці');
  assert.ok(at('id="ol-next"') < at('aria-labelledby="ol-how"'), '«Що далі» — перед «Як потрапити»');
  assert.match(page, /soonestDeadlines\(/);
  // Решта розділів на місці (не знімати функціонал мимохідь).
  for (const s of ['ol-stages', 'ol-subjects-title', 'ol-how', 'ol-open-title', 'tp-note-title', 'tp-faq-title', 'tp-related-title']) {
    assert.ok(page.includes(`id="${s}"`), s);
  }
  // «Інші підбірки» — 4 картки через спільний pickRelated (tests/related-topics.test.mjs),
  // олімпіади й конкурси першими.
  assert.match(page, /pickRelated\(\['mizhnarodni-olimpiady', 'konkursy'\], counted\)/);
  // Картка «Інших підбірок» — з тілом, як у підбірках: без нього текст упритул до рамки.
  assert.match(page, /className="tp-related-body"/);
});

test('сторінка: без слова «каталог»', () => {
  assert.doesNotMatch(page, /каталог/i);
  assert.match(page, /'Олімпіади', 'на платформі'/);
  assert.match(page, /listLabel: 'Олімпіади на платформі'/);
});
