// «Модний код» (Марія, 12.10.2026): безкоштовна студія образу; олімпіада —
// 99 грн, але поки тест не погоджено, оплати немає — лише список очікування.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const L = await import('../lib/modnyi-kod-looks.js');
const { MK } = await import('../lib/modnyi-kod.js');
const read = (f) => readFileSync(f, 'utf8');

test('кожна річ із меню має малюнок', () => {
  for (const k of ['base', 'top', 'bottom', 'outer', 'shoes', 'acc']) {
    for (const v of Object.keys(L.PIECES[k].opts)) {
      if (v === 'none' || v === 'set') continue;
      assert.equal(typeof L.shape[v], 'function', `${k}.${v}`);
      assert.match(L.shape[v]('#c8501a'), /<path|<ellipse|<rect/, `${k}.${v}`);
    }
  }
});

test('усі поєднання малюються, штани лягають поверх взуття', () => {
  const st = JSON.parse(JSON.stringify(L.DEFAULT_LOOK));
  for (const top of Object.keys(L.PIECES.top.opts)) for (const bottom of Object.keys(L.PIECES.bottom.opts)) {
    Object.assign(st, { base: 'set', top, bottom });
    const s = L.lookSvg(st, { live: true });
    assert.ok(s.indexOf('data-part="shoes"') < s.indexOf('data-part="bottom"'));
  }
  for (const base of ['dress1', 'dress2']) assert.match(L.lookSvg({ ...st, base }), /<g filter="url\(#mk-wob\)">/);
});

test('тканини, цілі й візерунки', () => {
  assert.ok(L.FABRICS.find(([k]) => k === 'metal'));
  assert.ok(L.DEFS.includes('id="metal"') && L.DEFS.includes('id="mk-wob"'));
  for (const [k] of L.FABRICS) assert.ok(L.DEFS.includes(`id="${k}"`), k);
  assert.deepEqual(L.usedPatterns(L.DEFAULT_LOOK).sort(), ['стьобана', 'шотландка'].sort());
  const t = L.targets({ ...L.DEFAULT_LOOK, base: 'dress1', acc: 'glasses' }).map(([k]) => k);
  assert.deepEqual(t, ['base', 'shoes', 'legs']);
});

test('збережений образ чиститься: лише відомі речі й тканини', () => {
  const c = L.cleanLook({ top: '<script>', shoes: 'loafer', f: { top: 'javascript:x', bottom: 'leo', shoes: '#ffffff' } });
  assert.equal(c.top, L.DEFAULT_LOOK.top);
  assert.equal(c.shoes, 'loafer');
  assert.equal(c.f.top, L.DEFAULT_LOOK.f.top);
  assert.equal(c.f.bottom, 'leo');
  assert.equal(c.f.shoes, '#ffffff');
  assert.deepEqual(L.cleanLook(null), L.DEFAULT_LOOK);
});

test('усе платне: 99 грн за все, студія — лише після оплати (поки — адмін)', () => {
  assert.equal(MK.price, 99);
  assert.equal(MK.open, false);
  const page = read('app/modnyi-kod/page.js');
  assert.doesNotMatch(page.replace(/^\/\/.*$/gm, ''), /безкоштовн/);
  assert.match(page, /modnyi-kod-demo\.mp4/);
  assert.match(page, /Waitlist/);
  const studioPage = read('app/modnyi-kod/studiya/page.js');
  assert.match(studioPage, /isAdmin\(/);
  assert.match(studioPage, /index: false/);
  const studio = read('app/modnyi-kod/Studio.js');
  assert.doesNotMatch(studio, /wayforpay|\/api\/.*pay/i);
  assert.match(studio, /if \(!title\.trim\(\)\)/);
  assert.match(read('app/api/modnyi-kod/waitlist/route.js'), /olimp: MK\.slug/);
});

// CLAUDE.md: назва лише «Dityam.com.ua» (на обкладинці — логотип «dityam.com.ua»).
test('бренд і фон', () => {
  for (const f of ['app/modnyi-kod/page.js', 'app/modnyi-kod/studiya/page.js', 'app/modnyi-kod/DeskCollage.js', 'app/modnyi-kod/Studio.js', 'app/modnyi-kod/Waitlist.js', 'lib/modnyi-kod.js', 'lib/modnyi-kod-looks.js']) {
    const t = read(f);
    assert.doesNotMatch(t, /DITYAM/, f);
    assert.doesNotMatch(t, /Dityam(?!\.com\.ua|\+)/, f);
  }
  // Ніколи не бежевий фон (memory: dityam-no-beige-background).
  assert.doesNotMatch(read('app/styles/modnyi-kod.css'), /#f6efe4|#fbf8f2|#fffdf7|#f4efe7|#fff4e8/i);
});

test('сторінка олімпіади як /olimpiada, студія — окремо', () => {
  const page = read('app/modnyi-kod/page.js');
  for (const h of ['Як це виглядає', 'Що отримує кожен учасник', 'Як це працює', 'Які бувають завдання', 'Обкладинка, яку хочеться', 'Взяти участь', 'Питання й відповіді', 'Напишіть нам', 'у соцмережах']) assert.ok(page.includes(h), h);
  assert.match(page, /<DeskCollage \/>/);
    assert.match(read('app/modnyi-kod/studiya/page.js'), /<Studio \/>/);
});

test('обкладинка у стилі Vogue: анонси з образу дитини, гарні назви', async () => {
  const src = read('app/modnyi-kod/VogueCover.js');
  assert.match(src, /dityam\.com\.ua/);
  assert.match(src, /Сміливість — головний тренд сезону/);
  assert.doesNotMatch(src, /стьобана/);
  assert.match(read('app/modnyi-kod/page.js'), /<VogueCover /);
  assert.match(read('app/modnyi-kod/Studio.js'), /<VogueCover /);
});
