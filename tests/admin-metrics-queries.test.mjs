import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { allNamed } from '../lib/allNamed.js';

test('allNamed повертає значення під своїми іменами', async () => {
  const r = await allNamed({ a: Promise.resolve(1), b: Promise.resolve(2), c: 3 });
  assert.deepEqual(r, { a: 1, b: 2, c: 3 });
});

test('allNamed виконує запити одночасно, а не по черзі', async () => {
  const started = [];
  const slow = (id) => new Promise((res) => { started.push(id); setTimeout(() => res(id), 20); });
  const t0 = Date.now();
  await allNamed({ x: slow('x'), y: slow('y'), z: slow('z') });
  assert.ok(Date.now() - t0 < 60, 'запити пішли послідовно');
});

// Сторож саме того збою, що поклав сторінку 29.09.2026. Без адмін-куки
// /admin/metrics малює форму входу й до запитів не доходить — тому впіймати
// це рендером не вийде, і перевіряємо сам текст файлу: кожне імʼя, яке
// сторінка розбирає, мусить бути ключем у переданому обʼєкті.
test('на /admin/metrics кожне розібране імʼя є ключем запиту', () => {
  const src = readFileSync(new URL('../app/admin/metrics/page.js', import.meta.url), 'utf8');
  const call = src.slice(src.indexOf('} = await allNamed({'));
  assert.ok(call, 'сторінка більше не використовує allNamed — оновіть тест');

  const destructured = src
    .slice(src.lastIndexOf('const {', src.indexOf('} = await allNamed({')), src.indexOf('} = await allNamed({'))
    .replace('const {', '')
    .split(',').map((x) => x.trim()).filter(Boolean);
  assert.ok(destructured.length >= 10, 'не вдалося прочитати список імен');

  const body = call.slice(call.indexOf('{'), call.indexOf('\n  });'));
  for (const name of destructured) {
    assert.ok(new RegExp(`(^|[\\s{,])${name}\\s*:`, 'm').test(body),
      `«${name}» розбирають, але такого запиту немає — результати поїдуть не туди`);
  }
});
