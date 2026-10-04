// Нічний режим (Марія, 04.10.2026: «зробити нічний режим на сайті»).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { THEMES, THEME_BOOT_SCRIPT, THEME_KEY, isTheme, themeAttr } from '../lib/theme.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const night = read('app/styles/night.css');

test('три стани, а не два', () => {
  // «Як у системі» — саме стан: інакше людина, яка раз обрала світлу, не мала б
  // чим повернути автоматику.
  assert.deepEqual(THEMES, ['auto', 'light', 'dark']);
  assert.equal(isTheme('auto'), true);
  assert.equal(isTheme('хтозна'), false);
});

test('у стані «як у системі» атрибута немає', () => {
  assert.equal(themeAttr('auto'), null);
  assert.equal(themeAttr('dark'), 'dark');
  assert.equal(themeAttr('light'), 'light');
});

test('скрипт теми ставить атрибут і не падає', () => {
  assert.doesNotThrow(() => new Function(THEME_BOOT_SCRIPT));
  assert.ok(THEME_BOOT_SCRIPT.includes(THEME_KEY), 'скрипт читає не той ключ');
  assert.ok(THEME_BOOT_SCRIPT.includes("setAttribute('data-theme'"));
  assert.ok(THEME_BOOT_SCRIPT.includes('try{'), 'без try приватне вікно валить сторінку');
});

test('скрипт стоїть у <body> — інакше сайт блимає білим', () => {
  const layout = read('app/layout.js');
  assert.ok(layout.includes('THEME_BOOT_SCRIPT'), 'layout не вставляє скрипт теми');
  // Першим має лишатись завантажувач варіанта картки (tests/ab-card.test.mjs),
  // тому тема — одразу за ним; на блимання порядок не впливає.
  assert.ok(layout.indexOf('AB_CARD_BOOT_SCRIPT') < layout.lastIndexOf('THEME_BOOT_SCRIPT'));
});

// --- найважливіше правило палітри ---
//
// Вибір людини сильніший за систему. Без :not([data-theme="light"]) людина з
// темною системою не змогла б лишитись на світлій темі зовсім.
test('ручний вибір «світла» перебиває системну темну', () => {
  assert.match(night, /@media \(prefers-color-scheme: dark\)/);
  assert.match(night, /:root:not\(\[data-theme="light"\]\)/,
    'системна темна має відступати перед ручним вибором світлої');
});

test('темна палітра оголошена для обох шляхів увімкнення', () => {
  // Ручний (data-theme="dark") і системний — обидва мусять знати кожен токен,
  // інакше частина сайту лишиться світлою в одному зі способів.
  // Зрізи обмежені саме двома блоками палітри: нижче у файлі є ще градієнти
  // й блок [data-admin], і без межі тест порівнював би палітру з ними.
  const start = night.indexOf(':root[data-theme="dark"]');
  const mid = night.indexOf('@media (prefers-color-scheme: dark)');
  const end = night.indexOf('/* ── Градієнти');
  assert.ok(start >= 0 && mid > start && end > mid, 'структура night.css змінилась — зрізи більше не ті');
  const manual = night.slice(start, mid);
  const auto = night.slice(mid, end);
  const names = (block) => new Set([...block.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((m) => m[1]));
  const a = names(manual);
  const b = names(auto);
  assert.ok(a.size > 25, `очікую повну палітру, знайдено ${a.size}`);
  assert.deepEqual([...a].filter((x) => !b.has(x)), [], 'у системному шляху бракує токенів');
  assert.deepEqual([...b].filter((x) => !a.has(x)), [], 'у ручному шляху бракує токенів');
});

test('color-scheme оголошено — інакше поля й смуги лишаються світлими', () => {
  assert.match(night, /color-scheme: dark/);
});

// --- контраст, порахований, а не на око ---
const lin = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const lum = (hex) => {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const ratio = (f, b) => { const [x, y] = [lum(f), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const tok = (name) => {
  const m = new RegExp(`:root\\[data-theme="dark"\\][\\s\\S]*?${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(night);
  assert.ok(m, `немає токена ${name}`);
  return m[1];
};

test('кожен текст нічної палітри проходить WCAG AA', () => {
  const bg = tok('--bg');
  const card = tok('--surface-2');
  for (const [name, on] of [
    ['--v2-ink', card], ['--v2-ink-2', card], ['--v2-ink-3', card],
    ['--v2-accent-strong', card], ['--v2-ink', bg], ['--v2-ink-3', bg],
    ['--chip-ink-purple', tok('--purple-1')],
    ['--chip-ink-teal', tok('--cool-2')],
    ['--chip-ink-green', tok('--green-1')],
    ['--chip-ink-amber', tok('--warm-2')],
    ['--chip-ink-pink', tok('--pink-2')],
    ['--state-urgent', bg], ['--state-ok', card], ['--state-link', card],
  ]) {
    const r = ratio(tok(name), on);
    assert.ok(r >= 4.5, `${name} на ${on}: ${r.toFixed(2)}:1 — нижче 4.5`);
  }
});

test('темний текст на яскравому помаранчевому теж читається', () => {
  // Білий на нічному акценті дає 2,3:1, тому текст кнопок темніє разом із темою.
  const r = ratio(tok('--surface-2'), tok('--v2-accent'));
  assert.ok(r >= 4.5, `текст на кнопці: ${r.toFixed(2)}:1`);
});

test('світлі градієнти в темряві гасяться', () => {
  // Токеном градієнт не заміниш: теплі плями світилися б як діри.
  assert.match(night, /background-image: none/);
  for (const sel of ['.v2-page', '.support-section', '.v2-choice', '.top-week']) {
    assert.ok(night.includes(sel), `градієнт ${sel} не погашено`);
  }
});

test('чорно-білий режим лишається сильнішим за нічний', () => {
  // Він для тих, кому кольори заважають читати; нічний не має його перебивати.
  assert.ok(night.includes('a11y-bw'), 'у night.css немає згадки про ч/б режим');
});
