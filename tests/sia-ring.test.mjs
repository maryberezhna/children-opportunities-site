// Текст по колу наліпки SIA (07.10.2026): крок пропорційний ширині символу,
// рівно один оберт — інакше широкі літери злипались, а пробіли зяяли.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { ringLayout, SIA_AWARD } = await import('../lib/awards.js');

test('кути зростають і вкладаються в один оберт', () => {
  const l = ringLayout(SIA_AWARD.ring.uk);
  assert.equal(l.length, [...SIA_AWARD.ring.uk].length);
  for (let i = 1; i < l.length; i += 1) assert.ok(l[i].deg > l[i - 1].deg);
  assert.ok(l[0].deg > 0 && l.at(-1).deg < 360);
});

test('широка Ж отримує більший крок, ніж пробіл', () => {
  const l = ringLayout('АЖБ В');
  const gapAfterZh = l[2].deg - l[1].deg;
  const gapAroundSpace = l[4].deg - l[3].deg;
  assert.ok(gapAfterZh > gapAroundSpace);
});
