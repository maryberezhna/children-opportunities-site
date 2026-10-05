import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// 05.10.2026 на /pidbirky і /erasmus текст карток стояв упритул до рамки, а
// заокруглений край обрізав першу літеру («ноземні мови», «Габори»). З #667
// відступи картки .tp-related-card живуть у внутрішньому .tp-related-body;
// сторінки, де картку зібрали без нього, лишились без відступів.

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}

test('кожна картка tp-related-card має внутрішній tp-related-body', () => {
  const root = new URL('../app', import.meta.url).pathname;
  const bad = [];
  for (const f of walk(root)) {
    const src = readFileSync(f, 'utf8');
    const re = /className="tp-related-card">([\s\S]*?)<\/Link>/g;
    for (const m of src.matchAll(re)) {
      if (!m[1].includes('tp-related-body')) bad.push(f.replace(root, 'app'));
    }
  }
  assert.deepEqual(bad, []);
});
