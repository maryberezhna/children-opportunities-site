// Анкета Dityam+ і обставини дитини.
import test from 'node:test';
import assert from 'node:assert/strict';

// 20.10.2026, Марія: «я сказала прибери обдаровані з фільтрів… з усього і на
// сайті теж». Мітку ставив робот будь-якому конкурсу зі словом «обдарован»,
// і підтвердити її ніхто не міг.
test('«обдаровані» прибрано з усіх списків і текстів', async () => {
  const { readFileSync } = await import('node:fs');
  const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  const { NEED_OPTIONS } = await import('../lib/plusProfile.js');
  assert.ok(!NEED_OPTIONS.some(([k]) => k === 'gifted'), 'анкета Dityam+ не пропонує обдарованість');
  const { NEED_FILTER_OPTS, NEED_LABELS } = await import('../lib/labels.js');
  assert.ok(!NEED_FILTER_OPTS.some(([k]) => k === 'gifted'), 'фільтра на сайті немає');
  assert.equal(NEED_LABELS.gifted, undefined, 'підпису на картці немає');
  // Конвеєр більше не ставить мітку й не вчить її ставити модель.
  assert.doesNotMatch(read('scraper/backfill_child_needs.py'), /"gifted"/);
  assert.doesNotMatch(read('scraper/normalizer.py'), /^- gifted/m);
  // У каналі немає рубрики «Для обдарованих дітей».
  assert.doesNotMatch(read('scripts/channel-plan.mjs'), /need-gifted/);
  // Політика конфіденційності не обіцяє поля, якого немає.
  assert.doesNotMatch(read('app/privacy/page.js'), /обдарован/);
  assert.doesNotMatch(read('app/en/privacy/page.js'), /gifted/);
});
