// Кого тегнути в Instagram — лише з посилань на сторінці джерела (28.09.2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handlesFromHtml, tagLine } from '../scripts/ig-handles.mjs';

test('акаунти з посилань, без дублів і службових шляхів', () => {
  const html = `
    <a href="https://www.instagram.com/Eurodesk/">IG</a>
    <a href="https://instagram.com/eurodesk?igsh=1">IG ще раз</a>
    <a href="https://www.instagram.com/p/C8abc/">пост</a>
    <a href="https://www.instagram.com/reel/xyz/">рілс</a>
    <a href='https://instagram.com/european_youth_eu'>EYP</a>`;
  assert.deepEqual(handlesFromHtml(html), ['Eurodesk', 'european_youth_eu']);
});

test('немає посилань — порожньо, а не вигадка', () => {
  assert.deepEqual(handlesFromHtml('<p>instagram: шукайте нас</p>'), []);
  assert.deepEqual(handlesFromHtml(null), []);
});

test('рядок для адмінчату каже, де знайдено акаунт', () => {
  assert.match(tagLine({ handles: ['eurodesk'], host: 'programmes.eurodesk.eu' }), /@eurodesk.*programmes\.eurodesk\.eu/);
  assert.match(tagLine({ handles: [], host: 'mon.gov.ua' }), /вручну/);
  assert.match(tagLine({ handles: [], host: null }), /вручну/);
});
