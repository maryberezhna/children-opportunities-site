// Імʼя дитини без «Відповісти» (14.10.2026): мама 4 рази написала «Даніїл
// Писарєв» у чат бота, а бот щоразу слав це адміну «Питанням Dityam+».
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { looksLikeChildName, OL_NAME_CB } from '../lib/olimpiada-bot.js';

test('імʼя з великої літери (1–3 слова) — так; питання, посилання, «Дякую» — ні', () => {
  for (const t of ['Писарєв Даніїл', 'Даніїл Писарєв', 'Даніїл', 'Анна-Марія Коваль', 'Олена Петрівна Коваль', 'Софійʼя']) {
    assert.equal(looksLikeChildName(t), true, t);
  }
  for (const t of ['Дякую', 'Добрий день', 'https://dityam.com.ua/o/juvenes', 'Скільки яблук в кошику', 'даніїл', 'Як записати дитину?', '']) {
    assert.equal(looksLikeChildName(t), false, t);
  }
});

test('імʼя влазить у callback_data (до 64 байтів)', () => {
  const long = 'Олександрина Костянтинівна Гриценко';
  if (looksLikeChildName(long)) assert.ok(Buffer.byteLength(OL_NAME_CB + long, 'utf8') <= 64);
});

test('бот перевіряє «схоже на імʼя» до пересилання адміну', () => {
  const route = readFileSync(new URL('../app/api/telegram/plus/route.js', import.meta.url), 'utf8');
  const nameAt = route.indexOf('looksLikeChildName(text)');
  const adminAt = route.indexOf('Підтримка у поданні: будь-який інший текст');
  assert.ok(nameAt > 0 && nameAt < adminAt);
});
