// «Топ тижня» — одна картка, що міняється (Марія, 04.10.2026: «1 можливість
// яку чітко видно… бо ми це продаємо, а зараз це тупо»).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SLIDE_MS, dateParts, nextIndex, prevIndex, shouldAutoPlay, sliderCards, swipeTo,
} from '../lib/top-week-slider.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('перемикання йде по колу в обидва боки', () => {
  assert.deepEqual([0, 1, 2].map((i) => nextIndex(i, 3)), [1, 2, 0]);
  assert.deepEqual([0, 1, 2].map((i) => prevIndex(i, 3)), [2, 0, 1]);
});

test('порожній список не ламає лічильник', () => {
  assert.equal(nextIndex(0, 0), 0);
  assert.equal(prevIndex(0, 0), 0);
});

// Автокарусель, яка не спиняється, — класична проблема доступності
// (WCAG 2.2.2): людина не встигає ні дочитати, ні натиснути.
test('сама крутиться лише тоді, коли нікому не заважає', () => {
  assert.equal(shouldAutoPlay({ total: 3, paused: false, touched: false, reducedMotion: false }), true);
  assert.equal(shouldAutoPlay({ total: 3, paused: true, touched: false, reducedMotion: false }), false);
  assert.equal(shouldAutoPlay({ total: 3, paused: false, touched: true, reducedMotion: false }), false);
  assert.equal(shouldAutoPlay({ total: 3, paused: false, touched: false, reducedMotion: true }), false);
  assert.equal(shouldAutoPlay({ total: 1, paused: false, touched: false, reducedMotion: false }), false);
});

test('після ручного перемикання таймер більше не втручається', () => {
  // touched лишається true назавжди — далі вирішує людина, а не таймер.
  assert.equal(shouldAutoPlay({ total: 3, paused: false, touched: true, reducedMotion: false }), false);
});

test('свайп рахує тільки справжній рух', () => {
  assert.equal(swipeTo(200, 100, 0, 3), 1, 'вліво — наступна');
  assert.equal(swipeTo(100, 200, 0, 3), 2, 'вправо — попередня, по колу');
  // Тремтіння пальця під час вертикальної прокрутки не має гортати картку.
  assert.equal(swipeTo(200, 180, 1, 3), 1);
});

test('картка збирається однаково з рядка бази', () => {
  const [a, b] = sliderCards([
    { slug: 'a', title: 'Конкурс', deadline: '2026-10-04', opportunity_type: 'competition', cost_type: 'free' },
    { slug: 'b', title: 'Гурток', deadline: null, opportunity_type: 'club', cost_type: 'paid_affordable' },
  ], {
    lang: 'uk', pinned: 'Топ', free: 'безкоштовно',
    type: { competition: 'Конкурс', club: 'Гурток' }, age: () => '10–14 років',
  });
  assert.equal(a.day, 4);
  assert.equal(a.month, 'жовт');
  assert.equal(a.meta, 'Конкурс · 10–14 років · безкоштовно');
  // Без дедлайну — підпис замість числа, а не порожня плашка.
  assert.equal(b.day, null);
  assert.equal(b.dateLabel, 'Топ');
  assert.equal(b.meta, 'Гурток · 10–14 років', 'платне не підписуємо «безкоштовно»');
});

test('англійська назва береться, коли вона є', () => {
  const [card] = sliderCards([{ slug: 'a', title: 'Конкурс', title_en: 'Contest' }], { lang: 'en' });
  assert.equal(card.title, 'Contest');
});

test('дата без дедлайну не вигадується', () => {
  assert.equal(dateParts(null), null);
  assert.equal(dateParts('нема'), null);
});

// --- блок стоїть там, де його продають ---
//
// Марія: «помісти топ 3 у всіх добірках». Трійка на підбірці рахується з УСІХ
// живих записів, а не з тих, що підпадають під підбірку: інакше оплачене
// місце з'являлось би на одних сторінках і зникало на інших.
test('і головна, і підбірки показують той самий блок', () => {
  for (const f of ['app/HomeHero.js', 'app/TopicPage.js']) {
    const src = read(f);
    assert.match(src, /<TopWeekSlider/, `${f}: блоку немає`);
    assert.match(src, /sliderCards\(/, `${f}: картки збираються не спільною функцією`);
  }
});

test('у підбірці трійка рахується з усіх живих записів', () => {
  const src = read('app/TopicPage.js');
  assert.match(src, /topWeekCards\(\{ items: liveRows/,
    'трійка має бути та сама, що на головній, інакше її нічим продати');
});

test('картка показується одна, але в розмітці лишаються всі три', () => {
  // Інакше пошуковик і читач екрана бачили б лише першу.
  const src = read('app/TopWeekSlider.js');
  assert.match(src, /cards\.map/, 'усі картки мають бути в розмітці');
  assert.match(src, /aria-hidden=\{n === i \? undefined : 'true'\}/);
  assert.match(src, /tabIndex=\{n === i \? undefined : -1\}/, 'прихована картка не має ловити таб');
});

test('пауза під мишею й на фокусі — у самому компоненті', () => {
  const src = read('app/TopWeekSlider.js');
  for (const h of ['onMouseEnter', 'onMouseLeave', 'onFocusCapture', 'onBlurCapture']) {
    assert.ok(src.includes(h), `немає ${h} — карусель крутитиметься під рукою`);
  }
});

test('картку видно достатньо, щоб прочитати назву', () => {
  assert.ok(SLIDE_MS >= 5000, 'швидше 5 секунд назву не дочитати');
});
