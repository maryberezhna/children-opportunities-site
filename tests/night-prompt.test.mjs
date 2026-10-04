// «Зараз нічна тема — лишити чи перейти на світлу?» (Марія, 04.10.2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  NIGHT_ASKED_KEY, NIGHT_FROM, NIGHT_TO, isKyivNight, kyivHour, shouldAskAboutNight,
} from '../lib/night-prompt.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const at = (iso) => new Date(iso);

// Київський час, а не браузерний: «ніч» тут про те, коли людина дивиться сайт
// з України, і мама в Торонто не має бачити «зараз ніч» о своїй шостій вечора.
test('ніч рахується за Києвом', () => {
  assert.equal(isKyivNight(at('2026-10-04T19:30:00Z')), true, '22:30 за Києвом — ніч');
  assert.equal(isKyivNight(at('2026-10-04T00:00:00Z')), true, '03:00 за Києвом — ніч');
  assert.equal(isKyivNight(at('2026-10-04T10:00:00Z')), false, '13:00 за Києвом — день');
  assert.equal(isKyivNight(at('2026-10-04T17:00:00Z')), false, '20:00 за Києвом — день');
});

test('літній і зимовий час рахуються самі', () => {
  // Зашите «+2» помилялося б пів року: 1 липня Україна на UTC+3.
  assert.equal(kyivHour(at('2026-07-01T12:00:00Z')), 15, 'літо: UTC+3');
  assert.equal(kyivHour(at('2026-01-01T12:00:00Z')), 14, 'зима: UTC+2');
});

test('межі ночі — рівно ті, що оголошені', () => {
  const sameDay = (h) => at(`2026-01-04T${String(h - 2).padStart(2, '0')}:00:00Z`); // зима: UTC+2
  assert.equal(isKyivNight(sameDay(NIGHT_FROM)), true, 'початок ночі вже ніч');
  assert.equal(isKyivNight(sameDay(NIGHT_FROM - 1)), false, 'за годину до — ще день');
  assert.equal(isKyivNight(sameDay(NIGHT_TO)), false, 'кінець ночі вже день');
});

test('питаємо лише коли є про що питати', () => {
  const night = at('2026-10-04T19:30:00Z');
  const base = { theme: 'auto', systemDark: true, asked: false, now: night };
  assert.equal(shouldAskAboutNight(base), true);
  // Людина вже обрала тему руками — у неї є відповідь, перепитувати означало б
  // не вірити власному інтерфейсу.
  assert.equal(shouldAskAboutNight({ ...base, theme: 'dark' }), false);
  assert.equal(shouldAskAboutNight({ ...base, theme: 'light' }), false);
  // Сайт і так світлий — питати нема про що.
  assert.equal(shouldAskAboutNight({ ...base, systemDark: false }), false);
  // Удень темна тема теж буває, але питання «зараз ніч» було б неправдою.
  assert.equal(shouldAskAboutNight({ ...base, now: at('2026-10-04T10:00:00Z') }), false);
});

test('питаємо рівно один раз на пристрій', () => {
  const night = at('2026-10-04T19:30:00Z');
  assert.equal(shouldAskAboutNight({ theme: 'auto', systemDark: true, asked: true, now: night }), false,
    'попап, який повертається, — це вже не турбота');
});

test('без аргументів не падає', () => {
  assert.doesNotThrow(() => shouldAskAboutNight());
});

// --- сам компонент ---
test('будь-яка з трьох дій закриває питання назавжди', () => {
  const src = read('app/NightThemePrompt.js');
  // Залишити, світла і хрестик — усі три ведуть в done(), який ставить позначку.
  assert.equal((src.match(/done\('(keep|light)'\)/g) || []).length, 3,
    'усі три дії мають закривати питання');
  assert.match(src, new RegExp(`setItem\\(${'NIGHT_ASKED_KEY'}`), 'позначка не ставиться');
});

test('«Світла» справді перемикає тему, а не лише ховає смужку', () => {
  const src = read('app/NightThemePrompt.js');
  assert.match(src, /setAttribute\('data-theme', 'light'\)/);
  assert.match(src, /setItem\(THEME_KEY, 'light'\)/, 'вибір має пережити перезавантаження');
});

test('в адмінці не показуємо', () => {
  assert.match(read('app/NightThemePrompt.js'), /pathname\.startsWith\('\/admin'\)/);
});

test('смужка, а не модалка поверх сторінки', () => {
  const css = read('app/styles/night-prompt.css');
  assert.doesNotMatch(css, /inset:\s*0/, 'накриття на весь екран тут не треба');
  assert.match(css, /position: fixed/);
  // Має стояти вище за плаваючу кнопку Telegram (10000), інакше сховається.
  assert.match(css, /z-index: 1000[1-9]/);
});

test('не падає в приватному вікні', () => {
  // localStorage там кидає — усі звернення мають бути в try.
  const src = read('app/NightThemePrompt.js');
  const calls = src.match(/localStorage\.\w+\([^)]*\)/g) || [];
  assert.ok(calls.length >= 3, 'очікую звернення до localStorage');
  for (const c of calls) {
    const i = src.indexOf(c);
    const before = src.slice(Math.max(0, i - 220), i);
    assert.ok(before.includes('try'), `без try: ${c}`);
  }
});

test('ключ позначки не збігається з ключем теми', () => {
  assert.notEqual(NIGHT_ASKED_KEY, 'dityam-theme');
});
