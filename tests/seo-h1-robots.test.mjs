// SEMrush-аудит 16.10.2026 (Марія скинула вивантаження ideas_dityam.com.ua):
// H1 на головній був 109 символів, бо текст наліпки «ПЕРЕМОЖЕЦЬ • SIA UKRAINE
// 2026 •» віддавався з сервера всередині <h1> — і то двічі (наліпка для
// широкого екрана й для вузького). robots.txt містив директиву Host, якої в
// стандарті немає. Опис головної був 196 символів замість ≤160.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('літери кільця нагороди не віддаються з сервера всередині H1', () => {
  const hero = read('app/HomeHero.js');
  assert.match(hero, /ringReady && ringLayout\(/, 'літери мають малюватись лише після монтування');
  assert.match(hero, /useEffect\(\(\) => \{ setRingReady\(true\); \}, \[\]\)/);
  // Сенс наліпки лишається доступним: він у aria-label самого посилання.
  assert.match(hero, /aria-label=\{SIA_AWARD\.full/);
});

test('robots.txt без директиви Host', () => {
  const robots = read('app/robots.js');
  assert.equal(/^\s*host:/m.test(robots), false, 'Host — нестандартна директива, аудити рахують її помилкою');
  assert.match(robots, /sitemap: 'https:\/\/dityam\.com\.ua\/sitemap\.xml'/);
});

test('опис головної вкладається в 160 символів', () => {
  const layout = read('app/layout.js');
  const m = layout.match(/description: `([^`]+)`/);
  assert.ok(m, 'не знайшов опис у metadata');
  // ${n} у шаблоні — лічильник можливостей, у проді 3 цифри.
  const rendered = m[1].replace('${n}', '550');
  assert.ok(rendered.length <= 160, `опис ${rendered.length} символів — більше за 160`);
});
