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
