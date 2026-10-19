// Марія, 11.10.2026: «де ми тут додаємо фільтри особлива потреба» — поля в
// адмінці не було, child_needs ставив лише робот. Тепер воно є в обох формах.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NEED_LABELS } from '../lib/labels.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('форма редагування показує й надсилає особливі потреби', () => {
  const form = read('app/admin/edit/[id]/EditForm.js');
  assert.match(form, /child_needs: opp\.child_needs \|\| \[\]/);
  assert.match(form, /Особлива потреба/);
  assert.match(form, /NEED_LABELS/);
});

test('сервер приймає лише відомі потреби', () => {
  const route = read('app/api/admin/edit/route.js');
  assert.match(route, /patch\.child_needs = .*NEED_LABELS/s);
  assert.ok(NEED_LABELS.disability && NEED_LABELS.idp && NEED_LABELS.veteran_family);
});

test('обидві форми отримують child_needs із бази', () => {
  assert.match(read('app/admin/edit/[id]/page.js'), /child_needs/);
  assert.match(read('app/admin/page.js'), /child_needs/);
});

test('адмінка й фільтр сайту — один список потреб', async () => {
  const { NEED_FILTER_OPTS } = await import('../lib/labels.js');
  assert.equal(NEED_FILTER_OPTS.length, 6);
  assert.match(read('app/admin/edit/[id]/EditForm.js'), /NEED_FILTER_OPTS\.map/);
  assert.match(read('app/OpportunitiesList.js'), /NEED_OPTS = NEED_FILTER_OPTS/);
});

// Марія, 19.10.2026: «взагалі прибери цей фільтр з сайту, це бред». Підпису
// немає — отже позначки не видно ні на картці, ні на сторінці, а сервер
// адмінки (фільтрує по NEED_LABELS) не дасть поставити її знову.
test('«обдаровані» більше немає ні у фільтрі, ні в підписах', async () => {
  const { NEED_FILTER_OPTS, NEED_LABELS: UK, NEED_LABELS_EN: EN } = await import('../lib/labels.js');
  assert.ok(!NEED_FILTER_OPTS.some(([value]) => value === 'gifted'));
  assert.ok(!Object.hasOwn(UK, 'gifted'));
  assert.ok(!Object.hasOwn(EN, 'gifted'));
});
