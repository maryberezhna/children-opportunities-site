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
  assert.match(tagLine({ handles: ['eurodesk'], host: 'programmes.eurodesk.eu' }), /programmes\.eurodesk\.eu/);
  assert.match(tagLine({ handles: [], host: 'mon.gov.ua' }), /вручну/);
  assert.match(tagLine({ handles: [], host: null }), /вручну/);
});

// 28.09.2026: «@eurodesk» з адмінчату не шукався в Instagram — логін без @,
// кожен окремо в <code>, щоб копіювався дотиком.
test('логіни в адмінчаті без @ і кожен окремо, щоб копіювались у пошук', () => {
  const line = tagLine({ handles: ['eurodesk', 'european_youth_eu'], host: 'a.eu' });
  assert.ok(!line.includes('@'), line);
  assert.match(line, /\n<code>eurodesk<\/code>\n<code>european_youth_eu<\/code>$/);
});

// Правило Марії 28.09.2026: у чернетці поста для Instagram стоїть, кого
// тегнути, — і лише акаунти, знайдені на сторінці джерела.
test('контент-агент передає знайдені акаунти моделі й вимагає їх у пості', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../scripts/content-agent.mjs', import.meta.url), 'utf8');
  const search = src.indexOf('instagramHandles(o.source_url)');
  const writeCall = src.indexOf('await write(items, clips, found)');
  assert.ok(search > -1 && writeCall > search, 'акаунти треба шукати ДО написання поста й передати в write()');
  assert.match(src, /Якщо в даних є рядок «Instagram», познач ці акаунти/);
  assert.match(src, /Інших акаунтів не\s+додавай і не вгадуй/);
  // Сухий прогін 28.09.2026: модель підписала @european_youth_eu
  // «Організатор —» під шкільним Erasmus+, де це лише портал зі сторінки.
  assert.match(src, /Не називай акаунт\s+«організатором»/);
  assert.ok(!/«організатор —\s*\n?\s*@/.test(src), 'у голосі не має бути зразка «організатор — @…»');
});
